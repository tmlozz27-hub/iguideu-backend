import "dotenv/config";
import mongoose from "mongoose";
import User from "./src/models/User.js";

const email = process.argv[2];
if(!email){
  console.error("Uso: node admin-make.mjs <email>");
  process.exit(1);
}

(async ()=>{
  try{
    if(!process.env.MONGO_URI){
      console.error("MONGO_URI no configurada");
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    const u = await User.findOneAndUpdate({ email }, { role: "admin" }, { new: true });
    if(!u){
      console.error("No existe el usuario:", email);
      process.exit(2);
    }
    console.log("[ADMIN] Actualizado:", u.email, "role=", u.role);
    await mongoose.disconnect();
  }catch(e){
    console.error(e);
    process.exit(3);
  }
})();
