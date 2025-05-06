const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let accessToken = "";
let logado = false;

// Login fixo
const USUARIO = "admin";
const SENHA = "1234";

// Middleware de login
app.get("/", (req, res) => {
  if (!logado) return res.redirect("/login");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Página de login
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === USUARIO && senha === SENHA) {
    logado = true;
    return res.redirect("/");
  } else {
    return res.send("❌ Usuário ou senha inválidos.");
  }
});

// OAuth Bling
app.get("/buscar-produto/:sku", async (req, res) => {
  const { sku } = req.params;
  if (!accessToken) return res.status(403).json({ mensagem: "Faça login via /auth." });

  try {
    const resposta = await axios.get(`https://www.bling.com.br/Api/v3/produtos?sku=${sku}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const produtoResumo = resposta.data?.data?.[0];
    if (!produtoResumo) throw new Error("Produto não encontrado.");

    const detalhes = await axios.get(`https://www.bling.com.br/Api/v3/produtos/${produtoResumo.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const produtoCompleto = detalhes.data?.data;
    const localizacao = produtoCompleto.estoque?.localizacao || "";
    const imagens = produtoCompleto.imagens || [];
    
    // Get all image URLs (not just the first one)
    const imagensUrls = imagens.map(img => img.link).filter(link => link);
    
    res.json({
      retorno: {
        produto: {
          id: produtoResumo.id,
          nome: produtoResumo.nome,
          localizacao,
          imagem: imagensUrls[0] || null,  // First image or null
          todasImagens: imagensUrls        // All images array
        }
      }
    });
  } catch (erro) {
    console.error("❌ Erro ao buscar produto:", erro.response?.data || erro.message);
    res.status(500).json({ mensagem: "Erro ao buscar produto." });
  }
});
// Buscar produto
// ... (importações e configuração inicial permanecem iguais)

app.get("/buscar-produto/:sku", async (req, res) => {
  const { sku } = req.params;
  if (!accessToken) return res.status(403).json({ mensagem: "Faça login via /auth." });

  try {
    const resposta = await axios.get(`https://www.bling.com.br/Api/v3/produtos?sku=${sku}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const produtoResumo = resposta.data?.data?.[0];
    if (!produtoResumo) throw new Error("Produto não encontrado.");

    const detalhes = await axios.get(`https://www.bling.com.br/Api/v3/produtos/${produtoResumo.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const produtoCompleto = detalhes.data?.data;
    const localizacao = produtoCompleto.estoque?.localizacao || "";
    const imagens = produtoCompleto.imagens || [];
    const primeiraImagem = imagens[0]?.link || null;

    res.json({
      retorno: {
        produto: {
          id: produtoResumo.id,
          nome: produtoResumo.nome,
          localizacao,
          imagem: primeiraImagem,
        }
      }
    });
  } catch (erro) {
    console.error("❌ Erro ao buscar produto:", erro.response?.data || erro.message);
    res.status(500).json({ mensagem: "Erro ao buscar produto." });
  }
});

// ... (demais rotas permanecem iguais)


// Atualizar localização
app.post("/atualizar-localizacao", async (req, res) => {
  const { produtoId, localizacao } = req.body;
  if (!accessToken) return res.status(403).json({ mensagem: "Faça login via /auth." });
  if (!produtoId || typeof localizacao !== "string") return res.status(400).json({ mensagem: "Dados inválidos." });

  try {
    const respostaBusca = await axios.get(`https://www.bling.com.br/Api/v3/produtos/${produtoId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const produtoAtual = respostaBusca.data?.data;

    const produtoAtualizado = {
      nome: produtoAtual.nome,
      codigo: produtoAtual.codigo,
      preco: produtoAtual.preco,
      unidade: produtoAtual.unidade,
      formato: produtoAtual.formato,
      tipo: produtoAtual.tipo,
      estoque: {
        localizacao: localizacao
      }
    };

    await axios.put(
      `https://www.bling.com.br/Api/v3/produtos/${produtoId}`,
      produtoAtualizado,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ mensagem: "Localização atualizada com sucesso!" });
  } catch (erro) {
    console.error("❌ Erro ao atualizar localização:", erro.response?.data || erro.message);
    res.status(500).json({ mensagem: "Erro ao atualizar localização." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
