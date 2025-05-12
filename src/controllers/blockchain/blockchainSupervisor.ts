import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as TicketNFT from "./TicketNFT.json";

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const iface = new ethers.Interface(TicketNFT.abi);

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS!,
  TicketNFT.abi,
  wallet
);

export default { contract, provider, iface }