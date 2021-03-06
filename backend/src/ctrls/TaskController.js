'use strict'
const { database } = require('../db')
const { taskAttributesBody, taskStatusBody, assignTaskBody } = require('../schemas')
const {
    getProject,
    notBelongsToProject,
    PROJECT_ROOT,
    setModifiedToNow,
    taskExists,
} = require('../refs')
const { invalidInput } = require('../errors')
const log = require('../log')

const taskEvents = {
    assignment: 'task assignment',
    creation: 'task creation',
    updateStatus: 'task status change'
}

// For each task related event, generate an event to /projects/<project_id>/events
// which acts as the project related history
const generateEventsUpdates = (projectId, taskId, taskEvent, input) => {
    const rootRef = `${PROJECT_ROOT}/${projectId}/events`
    const eventId = database.ref().child(rootRef).push().key
    const event = {
        created: new Date(),
        'event': taskEvent,
        input,
        taskId,
    }
    const updates = { [`${rootRef}/${eventId}`]: event }
    return updates
    // await database.ref().update(updates)
}

const TaskController = {

    // Create a new task in project
    // POST /project/{id}/task
    async createTask(req, res) {
        const { error, value } = taskAttributesBody.validate(req.body)
        if (error) {
            return res.status(422).json({ code: 422, message: error })
        }

        const project = await getProject(req.params.project_id)

        if (!project) {
            return res.status(404).json({ code: 404, message: 'Project not found'})
        }

        const members = (project.members && Object.keys(project.members)) || []

        if (req.auth_user.id !== project.admin && !members.find(member => member === req.auth_user.id)) {
            return res.status(403).json({ code: 403, message: 'Forbidden operation '})
        }

        const task = {
            ...value,
            assignments: { },
        }

        const rootRef = `${PROJECT_ROOT}/${req.params.project_id}/tasks`
        const taskId = database.ref().child(rootRef).push().key
        const updates = { [`${rootRef}/${taskId}`]: task }

        await Promise.all([
            await database.ref().update({
                ...updates,
                ...generateEventsUpdates(req.params.project_id, taskId, taskEvents.creation, task),
            }),
            setModifiedToNow(req.params.project_id),
        ])


        log.debug(`TaskController.createTask: created: ${taskId} with: ${JSON.stringify(updates)}`)
        res.status(201).json({ task_id: taskId })
    },

    // Update task's assignments
    // PUT /project/{id}/task/{id}/assignments
    async assignTask(req, res) {
        const { error, value } = assignTaskBody.validate(req.body)
        if (error) {
            return res.status(422).json(invalidInput(error))
        }

        // TODO: project not found? or just get rid of the 404 altogether from everywhere?

        const { admin, type } = await getProject(req.params.project_id) || { }

        if (admin !== req.auth_user.id || type !== 'group' ||
            !(await taskExists(req.params.project_id, req.params.task_id))) {
            return res.status(403).json({
                code: 403, message: 'Forbidden operation'
            })
        }

        const taskRef = `${PROJECT_ROOT}/${req.params.project_id}/tasks/${req.params.task_id}`
        const data = await database.ref(`${taskRef}/assignments`).set(
            value.assignments.reduce(
                (updates, assignment) => {
                    updates[`${assignment.id}`] = ''
                    return updates
                },
                { },
            )
        )

        await Promise.all([
            await database.ref().update(
                generateEventsUpdates(req.params.project_id, req.params.task_id, taskEvents.assignment, value)
            ),
            setModifiedToNow(req.params.project_id),
        ])

        log.debug(`TaskController.assignTask: updated ${req.params.task_id} with: ${JSON.stringify(data)}`)
        res.status(200).json({ taskId: req.params.task_id, assignments: value.assignments })
    },

    // PUT /project/{id}/task/{id}/status
    async updateTask(req, res) {
        const { error, value } = taskStatusBody.validate(req.body)
        if (error) {
            return res.status(422).json({ code: 422, message: error })
        }

        // TODO: project not found? or just get rid of the 404 altogether from everywhere?

        if (await notBelongsToProject(req.auth_user.id, req.params.project_id) ||
            !(await taskExists(req.params.project_id, req.params.task_id))) {
            return res.status(403).json({ code: 403, message: 'Forbidden operation' })
        }

        const taskRef = `${PROJECT_ROOT}/${req.params.project_id}/tasks/${req.params.task_id}`
        const data = await database.ref(`${taskRef}/status`).set(value.status)

        await Promise.all([
            await database.ref().update(
                generateEventsUpdates(req.params.project_id, req.params.task_id, taskEvents.updateStatus, value)
            ),
            setModifiedToNow(req.params.project_id),
        ])
        log.debug(`TaskController.updateTask: updated ${req.params.task_id} with: ${JSON.stringify(data)}`)
        res.status(200).json({ taskId: req.params.task_id, status: value.status })
    },
}

module.exports = TaskController
