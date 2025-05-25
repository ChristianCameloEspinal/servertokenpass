import { ethers } from "ethers";

const ETH_USD_RATE = 0.00001971;

export const usdToWei = (usd: number): bigint => {
    const ethValue = usd * ETH_USD_RATE;
    return ethers.parseUnits(ethValue.toFixed(18), "ether");
};

export const weiToUsd = (wei: bigint): number => {
    const eth = parseFloat(ethers.formatUnits(wei, "ether"));
    return eth / ETH_USD_RATE;
};
export const ethToUsd = (eth: bigint): number => {
    const ethFloat = parseFloat(ethers.formatUnits(eth, "ether"));
    return ethFloat / ETH_USD_RATE;
};

export const formatDateToDDMMYYYY = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
};