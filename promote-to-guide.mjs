import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./src/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const email = process.argv[2];
if(!email){ console.error("Uso: node promote-to-guide.mjs <email>"); process.exit(1); }

(async()=>{
  try{
    if(!process.env.MONGO_URI) { console.error("MONGO_URI no configurada"); process.exit(2); }
    await mongoose.connect(process.env.MONGO_URI);
    const u = await User.findOneAndUpdate({ email }, { role: "guide" }, { new: true });
    if(!u){ console.error("No se encontró usuario:", email); process.exit(3); }
    console.log("[PROMOTE] Usuario actualizado ->", u.email, "role:", u.role);
    await mongoose.disconnect();
    process.exit(0);
  }catch(e){
    console.error(e); process.exit(4);
  }
})();
