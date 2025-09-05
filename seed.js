import "dotenv/config";
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  { email:String, password:String, name:String },
  { timestamps:true }
);
const BookingSchema = new mongoose.Schema(
  {
    traveler: mongoose.Schema.Types.ObjectId,
    guide: String,
    startAt: Date,
    endAt: Date,
    price: Number,
    status: { type:String, default:"pending" }
  },
  { timestamps:true }
);

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.model("User", UserSchema);
  const Booking = mongoose.model("Booking", BookingSchema);

  const u = await User.create({ email:"seed@iguideu.com", password:"x", name:"Seed" });
  const now = new Date();
  const A = await Booking.create({
    traveler: u._id,
    guide: "g-seed",
    startAt: new Date(now.getTime()+2*3600e3),
    endAt:   new Date(now.getTime()+4*3600e3),
    price: 100,
    status: "confirmed"
  });
  console.log("OK seed:", { user:u._id.toString(), booking:A._id.toString() });
  await mongoose.disconnect();
}
main().catch(e=>{ console.error(e); process.exit(1); });
