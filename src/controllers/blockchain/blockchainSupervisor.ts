import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as TicketNFTJSON from "./TicketNFT.json";
import { TicketNFT } from "../../types/TicketNFT"; 

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!);
const iface = new ethers.Interface(TicketNFTJSON.abi);
const contractAddress = process.env.CONTRACT_ADDRESS!;

const getContractWithPrivateKey = (privateKey: string) : TicketNFT => {
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(
    contractAddress,
    TicketNFTJSON.abi,
    wallet
  ) as unknown as TicketNFT;
  return contract;
};

export default { getContractWithPrivateKey, provider, iface, contractAddress };