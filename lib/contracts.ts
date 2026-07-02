/** Wagmi-ready contract descriptors (address + abi). */
import {
  AgentRegistryAbi,
  PaymentLogAbi,
  MemoryVaultAbi,
  ComplianceAbi,
  LlmMeterAbi,
  Erc20Abi,
} from "@/lib/abis";
import { CONTRACTS } from "@/lib/constants";

export const agentRegistry = {
  address: CONTRACTS.AgentRegistry,
  abi: AgentRegistryAbi,
} as const;

export const paymentLog = {
  address: CONTRACTS.PaymentLog,
  abi: PaymentLogAbi,
} as const;

export const memoryVault = {
  address: CONTRACTS.MemoryVault,
  abi: MemoryVaultAbi,
} as const;

export const compliance = {
  address: CONTRACTS.Compliance,
  abi: ComplianceAbi,
} as const;

export const llmMeter = {
  address: CONTRACTS.LlmMeter,
  abi: LlmMeterAbi,
} as const;

export const erc20Abi = Erc20Abi;
