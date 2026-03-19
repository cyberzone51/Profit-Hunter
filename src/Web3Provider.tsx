import { createWeb3Modal } from '@web3modal/wagmi/react'
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'

import { WagmiProvider } from 'wagmi'
import { mainnet, bsc, polygon, arbitrum } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// 0. Setup queryClient
const queryClient = new QueryClient()

// 1. Get projectId from https://cloud.walletconnect.com
// Using a public demo projectId for the template
const projectId = 'b56e18d47c72ab683b10814fe9495694'

// 2. Create wagmiConfig
const metadata = {
  name: 'Profit Hunter',
  description: 'Pro Crypto Screener & Signals',
  url: 'https://profithunter.app', 
  icons: ['https://cdn-icons-png.flaticon.com/512/2489/2489756.png']
}

const chains = [mainnet, bsc, polygon, arbitrum] as const
export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
})

// 3. Create modal
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: false,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#2563eb', // blue-600
    '--w3m-border-radius-master': '1px'
  }
})

export function Web3ModalProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
