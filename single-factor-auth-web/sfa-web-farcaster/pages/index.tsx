import "@farcaster/auth-kit/styles.css";

import Head from "next/head";
import { useSession, signIn, signOut, getCsrfToken } from "next-auth/react";
import { SignInButton, AuthKitProvider, StatusAPIResponse } from "@farcaster/auth-kit";
import { Web3Auth, decodeToken } from "@web3auth/single-factor-auth";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { ADAPTER_EVENTS, CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from "@web3auth/base";
import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";

const config = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://mainnet.optimism.io",
  siweUri: "http://example.com/login",
  domain: "example.com",
};

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: {
    chainConfig: {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: "0xaa36a7",
      rpcTarget: "https://rpc.ankr.com/eth_sepolia",
      displayName: "Ethereum Sepolia Testnet",
      blockExplorerUrl: "https://sepolia.etherscan.io",
      ticker: "ETH",
      tickerName: "Ethereum",
    },
  },
});

const verifier = "w3a-farcaster-demo";

const web3auth = new Web3Auth({
  clientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ", // Get your Client ID from the Web3Auth Dashboard
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
  usePnPKey: false, // By default, this SDK returns CoreKitKey by default.
});

const login = async (idToken: any) => {
  if (!web3auth.ready) {
    console.log("web3auth initialised yet");
    return;
  }
  const { payload } = decodeToken(idToken);

  const web3authProvider = await web3auth.connect({
    verifier,
    verifierId: (payload as any).sub,
    idToken,
  });
  return web3authProvider;
};

const getAccounts = async (provider: IProvider) => {
  if (!provider) {
    console.log("provider not initialized yet");
    return;
  }

  const ethersProvider = new ethers.BrowserProvider(provider as any);

  const signer = await ethersProvider.getSigner();

  // Get user's Ethereum public address
  const address = await signer.getAddress();
  console.log("ETH Address:", address);
  uiConsole("ETH Address:", address);
  return address;
};

const getBalance = async (provider: IProvider) => {
  if (!provider) {
    console.log("provider not initialized yet");
    return;
  }

  const ethersProvider = new ethers.BrowserProvider(provider as any);

  const signer = await ethersProvider.getSigner();

  // Get user's Ethereum public address
  const address = signer.getAddress();

  const balance = ethers.formatEther(
    await ethersProvider.getBalance(address) // Balance is in wei
  );
  console.log("Balance:", balance);
  uiConsole("Balance:", balance);
  return balance;
};

const signMessage = async (provider: IProvider) => {
  if (!provider) {
    console.log("provider not initialized yet");
    return;
  }
  const ethersProvider = new ethers.BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();

  const message = "Hello world!";
  const signedMessage = await signer.signMessage(message);
  console.log("Signed Message:", signedMessage);
  uiConsole(signedMessage);
  return signedMessage;
};

const signTransaction = async (provider: IProvider) => {
  if (!provider) {
    console.log("provider not initialized yet");
    return;
  }
  const ethersProvider = new ethers.BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();

  const destination = "0xeaA8Af602b2eDE45922818AE5f9f7FdE50cFa1A8";
  const amount = ethers.parseEther("0.005");
  const tx = await signer.sendTransaction({
    to: destination,
    value: amount,
    // maxPriorityFeePerGas: "5000000000", // Max priority fee per gas
    // maxFeePerGas: "6000000000000", // Max fee per gas
  });

  const receipt = await tx.wait();
  console.log("Transaction Receipt:", receipt);
  uiConsole(receipt);
  return receipt;
};

const logOut = async () => {
  await web3auth.logout();
  await signOut();
};

function uiConsole(...args: any[]): void {
  const el = document.querySelector("#console>p");
  if (el) {
    el.innerHTML = JSON.stringify(args || {}, null, 2);
  }
}

export default function Home() {
  return (
    <>
      <Head>
        <title>Web3Auth + Farcaster AuthKit + NextAuth Demo</title>
      </Head>
      <main style={{ fontFamily: "Inter, sans-serif" }}>
        <AuthKitProvider config={config}>
          <Content />
        </AuthKitProvider>
      </main>
    </>
  );
}

function Content() {
  const [error, setError] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await web3auth.init(privateKeyProvider);

        if (web3auth.status === ADAPTER_EVENTS.CONNECTED) {
          console.log("Web3Auth Status", web3auth.status);
        }
      } catch (error) {
        console.error(error);
      }
    };

    init();
  }, []);

  const getNonce = useCallback(async () => {
    const nonce = await getCsrfToken();
    if (!nonce) throw new Error("Unable to generate nonce");
    return nonce;
  }, []);

  const handleSuccess = useCallback(async (res: StatusAPIResponse) => {
    console.log("response", res);
    await signIn("credentials", {
      message: res.message,
      signature: res.signature,
      name: res.displayName,
      username: res.username,
      pfp: res.pfpUrl,
      redirect: false,
    });
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userData: res }),
    });
    const data = await response.json();
    const token = data.token;
    console.log("token", token);
    const web3authProvider = await login(token);
    const accounts = await getAccounts(web3authProvider as IProvider);
    console.log("accounts", accounts);
  }, []);

  return (
    <div>
      <div style={{ position: "fixed", top: "12px", right: "12px" }}>
        <SignInButton nonce={getNonce} onSuccess={handleSuccess} onError={() => setError(true)} onSignOut={() => logOut()} />
        {error && <div>Unable to sign in at this time.</div>}
      </div>

      <div style={{ paddingTop: "33vh", textAlign: "center" }}>
        <h1>Web3Auth + @farcaster/auth-kit + NextAuth</h1>
        <p>
          This example app shows how to use{" "}
          <a href="https://docs.farcaster.xyz/auth-kit/introduction" target="_blank" rel="noreferrer">
            Farcaster AuthKit
          </a>{" "}
          and{" "}
          <a href="https://next-auth.js.org/" target="_blank" rel="noreferrer">
            NextAuth.js
          </a>{" "}
          with{" "}
          <a href="https://web3auth.io" target="_blank" rel="noreferrer">
            Web3Auth
          </a>
          .
        </p>
        <Profile />
      </div>
      <p style={{ paddingTop: "22vh", textAlign: "center" }}>
        <a
          href="https://github.com/Web3Auth/web3auth-core-kit-examples/tree/main/single-factor-auth-web/sfa-web-farcaster"
          target="_blank"
          rel="noreferrer"
        >
          Source code
        </a>
      </p>
      <p style={{ paddingTop: "2vh", textAlign: "center" }}>
        <a
          href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FWeb3Auth%2Fweb3auth-core-kit-examples%2Ftree%2Fmain%2Fsingle-factor-auth-web%2Fsfa-web-farcaster"
          target="_blank"
          rel="noreferrer"
        >
          <img src="https://vercel.com/button" alt="Deploy with Vercel" />
        </a>
      </p>
    </div>
  );
}

function Profile() {
  const { data: session } = useSession();

  return session ? (
    <div style={{ fontFamily: "sans-serif" }}>
      <p>Signed in as {session.user?.name}</p>
      <p>
        <button type="button" style={{ padding: "6px 12px", cursor: "pointer" }} onClick={() => logOut()}>
          Click here to sign out
        </button>
      </p>
      <p>
        <button
          type="button"
          style={{ padding: "6px 12px", margin: "6px 6px", cursor: "pointer" }}
          onClick={() => getAccounts(web3auth.provider as IProvider)}
        >
          Get Account
        </button>
        <button
          type="button"
          style={{ padding: "6px 12px", margin: "6px 6px", cursor: "pointer" }}
          onClick={() => getBalance(web3auth.provider as IProvider)}
        >
          Get Balance
        </button>
        <button
          type="button"
          style={{ padding: "6px 12px", margin: "6px 6px", cursor: "pointer" }}
          onClick={() => signMessage(web3auth.provider as IProvider)}
        >
          Sign Message
        </button>
        <button
          type="button"
          style={{ padding: "6px 12px", margin: "6px 6px", cursor: "pointer" }}
          onClick={() => signTransaction(web3auth.provider as IProvider)}
        >
          Send Transaction
        </button>
      </p>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>
    </div>
  ) : (
    <p>Click the &quot;Sign in with Farcaster&quot; button above, then scan the QR code to sign in.</p>
  );
}
