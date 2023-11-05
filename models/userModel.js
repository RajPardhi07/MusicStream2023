const mongoose = require('mongoose')

const passportLocalMongoose = require('passport-local-mongoose')

const userSchema = mongoose.Schema({

    username:String,
    email:String,
    contact:String,
    
    playlist:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:'playlist'
        }
    ],
    likes:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:'song'
        }
    ],
    profileImage:{
        type:String,
        default:'/images/green.png'
    },

    isAdmin:{
        type:Boolean,
        default:false
    }
})
userSchema.plugin(passportLocalMongoose)


const userModel = mongoose.model('user', userSchema)

module.exports = userModel;

