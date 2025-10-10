import mongoose from "mongoose";

const NoteSchema = new mongoose.Schema(
  { text: { type: String, required: true } },
  { timestamps: true }
);

export default mongoose.model("Note", NoteSchema);
