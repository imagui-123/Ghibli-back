const jwt = require('jsonwebtoken');
require('dotenv').config();
const expressJwt = require('express-jwt');
const User = require('../models/user');
const _ = require("lodash");
const { sendEmail } = require("../helpers");
// load env
const dotenv = require("dotenv");
dotenv.config();

exports.signup = async (req, res) => {
    const userExists = await User.findOne({ email: req.body.email});
    if(userExists)
        return res.status(403).json({
            error: 'Email is taken!'
        });
    const user = await new User(req.body);
    await user.save();
    res.status(200).json({ message: ' Signup success! Please login.' });
};

exports.signin = (req, res) =>{
    //find the user based on email
    const {email, password} = req.body;
    User.findOne({email}, (err, user) => {
        //if error or no user
        if(err || !user){
            return res.status(401).json({
                error: 'User with that email does not exists. Please signup.'
            });
        }
        // if user is found make sure the email and password match
        // create authenticate method in model and use here
        if(!user.authenticate(password)) {
            return res.status(401).json({
                error: "Email and password do not match"
            });
        }
         // generate a token with user id and secret
        const token = jwt.sign({_id: user._id}, process.env.JWT_SECRET);    
        //persist the token as 't' in cookie with expire date
        res.cookie("t", token, {expire: new Date() + 9999})
         //return response with user and token to frontend client
        const {_id, name, email} = user;
        return res.json({token, user: {_id, email, name} });
    });
};


exports.signout = (req, res) => {
    res.clearCookie('t')
    return res.json({message: "Signout success!"});
};

exports.requireSignin = expressJwt ({
    // if the token is valid, express jwt appends the verified users id
    // in an auth key to the request object
    secret: process.env.JWT_SECRET,
    userProperty: 'auth'
});

// add forgotPassword and resetPassword methods
exports.forgotPassword = (req, res) => {
    if (!req.body) return res.status(400).json({ message: "No request body" });
    if (!req.body.email)
        return res.status(400).json({ message: "No Email in request body" });
 
    console.log("forgot password finding user with that email");
    const { email } = req.body;
    console.log("signin req.body", email);
    // find the user based on email
    User.findOne({ email }, (err, user) => {
        // if err or no user
        if (err || !user)
            return res.status("401").json({
                error: "User with that email does not exist!"
            });
 
        // generate a token with user id and secret
        const token = jwt.sign(
            { _id: user._id, iss: "NODEAPI" },
            process.env.JWT_SECRET
        );
 
        // email data
        const emailData = {
            from: "noreply@node-react.com",
            to: email,
            subject: "Password Reset Instructions",
            text: `Please use the following link to reset your password: ${
                process.env.CLIENT_URL
            }/reset-password/${token}`,
            html: `<p>Please use the following link to reset your password:</p> <p>${
                process.env.CLIENT_URL
            }/reset-password/${token}</p>`
        };
 
        return user.updateOne({ resetPasswordLink: token }, (err, success) => {
            if (err) {
                return res.json({ message: err });
            } else {
                sendEmail(emailData);
                return res.status(200).json({
                    message: `Email has been sent to ${email}. Follow the instructions to reset your password.`
                });
            }
        });
    });
};

exports.resetPassword = (req, res) => {
    const { resetPasswordLink, newPassword } = req.body;
 
    User.findOne({ resetPasswordLink }, (err, user) => {
        // if err or no user
        if (err || !user)
            return res.status("401").json({
                error: "Invalid Link!"
            });
 
        const updatedFields = {
            password: newPassword,
            resetPasswordLink: ""
        };
 
        user = _.extend(user, updatedFields);
        user.updated = Date.now();
 
        user.save((err, result) => {
            if (err) {
                return res.status(400).json({
                    error: err
                });
            }
            res.json({
                message: `Great! Now you can login with your new password.`
            });
        });
    });
};