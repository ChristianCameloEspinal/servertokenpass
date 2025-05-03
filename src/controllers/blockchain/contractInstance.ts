import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import TicketNFT from './TicketNFT.json';
 
dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS!,
  TicketNFT.abi,
  provider
);

export default contract;
