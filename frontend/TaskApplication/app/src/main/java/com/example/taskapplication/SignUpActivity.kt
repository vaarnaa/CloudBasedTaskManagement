package com.example.taskapplication

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.TextUtils
import android.util.Log
import android.view.View
import android.widget.Toast
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.UserProfileChangeRequest
import kotlinx.android.synthetic.main.activity_signup.*

class SignUpActivity : BaseActivity(), View.OnClickListener {
    // Declare an instance of Firebase Auth.
    private lateinit var auth: FirebaseAuth

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // TODO: Add an option for an optional profile image in activity_signup.
        setContentView(R.layout.activity_signup)
        // These call findViewById on the first time, and then cache the values
        // for faster access in subsequent calls. Clicks are handled in `onClick`.
        buttonSignupSubmit.setOnClickListener(this)
        // Initialize Firebase Auth.
        auth = FirebaseAuth.getInstance()
    }

    private fun createAccount(email: String, password: String) {
        Log.d(TAG, "createAccount:$email")
        if (!validateForm()) {
            return
        }
        showProgressDialog()
        auth.createUserWithEmailAndPassword(email, password)
            .addOnCompleteListener(this) { task ->
                if (task.isSuccessful) {
                    // Sign in success.
                    Log.d(TAG, "createUserWithEmail:success")
                    // Set the display name and profile image of the user.
                    val user = auth.currentUser
                    val profileUpdates = UserProfileChangeRequest.Builder()
                        .setDisplayName(et_username.text.toString())
                        .setPhotoUri(Uri.parse(et_prof_img.text.toString()))
                        .build()
                    user?.updateProfile(profileUpdates)
                        ?.addOnCompleteListener { t ->
                            if (t.isSuccessful) {
                                Log.d(TAG, "User profile updated.")
                            }
                        }
                    // Redirect the user to the user activity.
                    val intent = Intent(this, UserActivity::class.java)
                    startActivity(intent)
                } else {
                    // If sign in fails, display a message to the user.
                    Log.w(TAG, "createUserWithEmail:failure", task.exception)
                    Toast.makeText(baseContext, "Signing up failed.",
                        Toast.LENGTH_SHORT).show()
                }
                hideProgressDialog()
            }
    }

    private fun validateForm(): Boolean {
        var valid = true
        val username = et_username.text.toString()
        // TODO: Username must be unique (checked from Firebase storage).
        if (TextUtils.isEmpty(username)) {
            et_username.error = "Required."
            valid = false
        } else {
            et_username.error = null
        }
        val email = et_email.text.toString()
        if (TextUtils.isEmpty(email)) {
            et_email.error = "Required."
            valid = false
        } else {
            et_email.error = null
        }
        val password = et_password.text.toString()
        if (TextUtils.isEmpty(password)) {
            et_password.error = "Required."
            valid = false
        } else {
            et_password.error = null
        }
        return valid
    }

    override fun onClick(v: View) {
        when (v.id) {
            R.id.buttonSignupSubmit -> createAccount(et_email.text.toString(), et_password.text.toString())
        }
    }

    companion object {
        // Used for printing debug messages. Usage: Log.d(TAG, "message")
        private const val TAG = "SignUpActivity"
    }
}