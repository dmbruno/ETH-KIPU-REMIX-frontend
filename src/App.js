import React, { useEffect, useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import wallAbi from "./wallAbi.json";
import './App.css';

const wallAddress = process.env.REACT_APP_WALL_CONTRACT_ADDRESS;

function App() {
  const [names, setNames] = useState([]);
  const [newName, setNewName] = useState("");
  const [networkInfo, setNetworkInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  

  
  const calculateSpiralPosition = (index, total) => {
    const angle = index * (2 * Math.PI / 5) + (index * 0.5); 
    const radius = 80 + (index * 25); 
    
    
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    
    const centerX = 50; 
    const centerY = 50; 
    
    return {
      left: `calc(${centerX}% + ${x}px)`,
      top: `calc(${centerY}% + ${y}px)`,
      transform: `translate(-50%, -50%) rotate(${angle * 10}deg)`,
      animationDelay: `${index * 0.1}s`
    };
  };

  useEffect(() => {
    async function fetchNames() {
      if (!window.ethereum) {
        alert("Por favor instalá MetaMask para interactuar con la blockchain.");
        return;
      }

      
      if (!wallAddress || !wallAddress.startsWith("0x") || wallAddress.length !== 42) {
        alert("La dirección del contrato no es válida.");
        return;
      }

      const provider = new BrowserProvider(window.ethereum);

      try {
        
        const accounts = await provider.listAccounts();
        if (accounts.length === 0) {
          await provider.send("eth_requestAccounts", []);
        }
      } catch (err) {
        
        console.error("MetaMask error:", err);
        return;
      }

      try {
        // Verificar la red actual
        const network = await provider.getNetwork();
        console.log("Red actual:", network.name, "Chain ID:", network.chainId);
        setNetworkInfo({
          name: network.name,
          chainId: network.chainId.toString()
        });
        
        // Verificar que estemos en Sepolia
        if (network.chainId !== 11155111n) {
          alert(`Esta aplicación está configurada para Sepolia testnet (Chain ID: 11155111). Actualmente estás en ${network.name} (Chain ID: ${network.chainId}). Por favor cambia a Sepolia en MetaMask.`);
          return;
        }
        
        const wallContract = new Contract(wallAddress, wallAbi, provider);
        
        // Verificar si el contrato existe
        const code = await provider.getCode(wallAddress);
        if (code === "0x") {
          console.error("No hay contrato deployado en esa dirección para esta red");
          alert(`No se encontró el contrato en la dirección ${wallAddress} en Sepolia. Verifica que la dirección sea correcta y que el contrato esté deployado en Sepolia.`);
          return;
        }
        
        // Verificar count primero
        try {
          const count = await wallContract.count();
          console.log("Cantidad de nombres en el contrato:", count.toString());
          
          if (count === 0n) {
            console.log("El contrato no tiene nombres aún");
            setNames([]);
            return;
          }
          
          
          const nombres = await wallContract.getNames();
          console.log("Nombres obtenidos:", nombres);
          setNames(nombres);
        } catch (countErr) {
          console.error("Error obteniendo count:", countErr);
          
          try {
            const nombres = await wallContract.getNames();
            console.log("Nombres obtenidos (sin count):", nombres);
            setNames(nombres);
          } catch (getNamesErr) {
            console.error("Error obteniendo nombres:", getNamesErr);
            setNames([]);
          }
        }
      } catch (err) {
        console.error("Contract error:", err);
        
        
        if (err.message.includes("could not decode result data")) {
          console.error("El contrato devolvió datos vacíos - probablemente no hay nombres almacenados");
        }
      }
    }

    fetchNames();
  }, []);

  const addName = async () => {
    if (!newName.trim()) {
      alert("Por favor ingresa un nombre");
      return;
    }

    if (!window.ethereum) {
      alert("Por favor instalá MetaMask para interactuar con la blockchain.");
      return;
    }

    setIsLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const wallContract = new Contract(wallAddress, wallAbi, signer);

      // Verificar red antes de proceder
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) {
        alert("Por favor cambia a Sepolia testnet en MetaMask");
        setIsLoading(false);
        return;
      }

      // Verificar si el usuario ya agregó un nombre (comentamos temporalmente)
      try {
        const userAddress = await signer.getAddress();
        console.log("Dirección del usuario:", userAddress);
        
        const hasAdded = await wallContract.hasAdded(userAddress);
        console.log("¿Usuario ya agregó nombre?", hasAdded);
        
        if (hasAdded) {
          alert("Ya agregaste un nombre al muro");
          setIsLoading(false);
          return;
        }
      } catch (hasAddedError) {
        console.error("Error verificando hasAdded (continuamos de todas formas):", hasAddedError);
        // Continuamos sin verificar si ya agregó un nombre
      }

      console.log("Intentando agregar nombre:", newName);
      const tx = await wallContract.addName(newName);
      console.log("Transacción enviada:", tx.hash);
      
      await tx.wait();
      console.log("Transacción confirmada");
      
      // Refrescar los nombres
      try {
        const nombres = await wallContract.getNames();
        setNames(nombres);
        setNewName("");
      } catch (getNamesError) {
        console.error("Error obteniendo nombres después de agregar:", getNamesError);
        // Refrescar la página para ver los cambios
        window.location.reload();
      }
      
    } catch (err) {
      console.error("Error agregando nombre:", err);
      alert("Error agregando nombre: " + err.message);
    }
    setIsLoading(false);
  };

  return (
    <div className="app-container">
      {/* Header fijo en la parte superior */}
      <div className="header">
        <div className="header-content">
          <div className="header-info">
            <h1 className="title">Muro ETH-KIPU</h1>
            <div className="contract-info">
              Contrato: {wallAddress}
            </div>
            <div className="faucet-info">
              💧 Sepolia Testnet - ETH gratuito en faucets
            </div>
          </div>
          
          {networkInfo && (
            <div className={`network-info ${networkInfo.chainId === "11155111" ? "connected" : "disconnected"}`}>
              {networkInfo.name} | {networkInfo.chainId}
              {networkInfo.chainId !== "11155111" && " ⚠️ Usar Sepolia"}
            </div>
          )}

          <div className="add-name-section">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tu nombre"
              className="name-input"
              disabled={isLoading}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && addName()}
            />
            <button 
              onClick={addName}
              disabled={isLoading}
              className="add-button"
            >
              {isLoading ? "..." : "Agregar"}
            </button>
          </div>
        </div>
      </div>

      {/* Contenedor de la espiral */}
      <div className="spiral-container">
        {/* Centro de la espiral */}
        <div className="spiral-center">
          ETH
        </div>

        {/* Nombres en espiral */}
        {names.map((name, index) => {
          const position = calculateSpiralPosition(index, names.length);
          return (
            <div
              key={index}
              className="name-spiral-item"
              style={{
                ...position,
                animationDelay: `${index * 0.1}s`
              }}
              title={`Miembro #${index + 1}: ${name}`}
            >
              {name}
            </div>
          );
        })}

        {/* Estado vacío */}
        {names.length === 0 && (
          <div className="empty-state">
            <div style={{ fontSize: "2rem", marginBottom: "10px" }}>🌀</div>
            <p>El muro está vacío</p>
            <p>¡Sé el primero en agregar tu nombre!</p>
          </div>
        )}
      </div>

      {/* Contador de nombres */}
      {names.length > 0 && (
        <div className="names-count">
          {names.length} nombre{names.length !== 1 ? 's' : ''} en el muro
        </div>
      )}
    </div>
  );
}
console.log("Dirección de contrato2:", wallAddress);
export default App;