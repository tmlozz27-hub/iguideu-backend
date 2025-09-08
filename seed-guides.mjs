import "dotenv/config";
import mongoose from "mongoose";
import Guide from "./src/models/Guide.js";

const seed = [
  { code:"g1001", name:"Ana López",     city:"Buenos Aires", price:100, active:true },
  { code:"g1002", name:"Bruno García",  city:"Córdoba",       price:120, active:true },
  { code:"g1003", name:"Carla Pérez",   city:"Rosario",       price:110, active:true },
  { code:"g2001", name:"Diego Torres",  city:"Montevideo",    price:130, active:true },
  { code:"g3001", name:"Elena Díaz",    city:"Santiago",      price:140, active:true },
];

(async ()=>{
  try{
    if(!process.env.MONGO_URI){
      console.error("MONGO_URI no configurada");
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    await Guide.deleteMany({});
    await Guide.insertMany(seed);
    console.log("[SEED] guides insertados:", seed.length);
    await mongoose.disconnect();
  }catch(e){
    console.error(e);
    process.exit(2);
  }
})();
