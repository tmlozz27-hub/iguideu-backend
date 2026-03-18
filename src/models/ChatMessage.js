import mongoose from "mongoose"

const ChatMessageSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },

    senderId: {
      type: String,
      required: true,
      trim: true
    },

    senderType: {
      type: String,
      enum: ["traveler", "guide"],
      required: true
    },

    type: {
      type: String,
      enum: ["text", "image", "location"],
      default: "text"
    },

    text: {
      type: String,
      default: ""
    },

    mediaUrl: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "chat_messages"
  }
)

ChatMessageSchema.index({ bookingId: 1, createdAt: -1 })

const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model("ChatMessage", ChatMessageSchema)

export default ChatMessage