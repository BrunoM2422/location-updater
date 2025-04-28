const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

let accessToken = "";

console.log("🚀 Servidor iniciando...");

// Redireciona para o consentimento do Bling
app.get("/auth", (req, res) => {
  const state = Math.random().toString(36).substring(2);
  const redirectUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${process.env.BLING_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=produtos_write&state=${state}`;
  res.redirect(redirectUrl);
});

// Callback - troca o código pelo token e redireciona para o site de atualização
app.get("/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Código de autorização ausente.");
  }

  console.log("✔️ Código de autorização recebido:", code);

  const basicAuth = Buffer.from(`${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`).toString("base64");

  try {
    const resposta = await axios.post(
      "https://www.bling.com.br/Api/v3/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.REDIRECT_URI,
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    accessToken = resposta.data.access_token;
    console.log("✅ Token recebido:", resposta.data);

    // Redireciona para o site de atualização
    res.redirect("https://atualizador-site.vercel.app/");
  } catch (erro) {
    console.error("❌ Erro ao obter token:", erro.response?.data || erro.message);
    res.status(500).send("Erro ao autenticar.");
  }
});

// Atualizar localização
app.post("/atualizar-localizacao", async (req, res) => {
  const { sku, localizacao, depositoId } = req.body;

  if (!accessToken) {
    return res.status(403).json({ mensagem: "Token de acesso não encontrado. Faça login via /auth." });
  }

  try {
    await axios.patch(
      `https://www.bling.com.br/Api/v3/produtos/${sku}`,
      {
        depositos: [{ id: depositoId, localizacao }],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ mensagem: "Localização atualizada com sucesso!" });
  } catch (erro) {
    console.error("❌ Erro ao atualizar:", erro.response?.data || erro.message);
    res.status(500).json({ mensagem: "Erro ao atualizar localização." });
  }
});

// Buscar produto (com SKU no parâmetro)
app.get("/buscar-produto/:sku", async (req, res) => {
  const { sku } = req.params;

  if (!accessToken) {
    return res.status(403).json({ mensagem: "Token de acesso não encontrado. Faça login via /auth." });
  }

  try {
    const resposta = await axios.get(`https://www.bling.com.br/Api/v3/produtos?sku=${sku}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const produto = resposta.data?.data?.[0]; // Primeiro da lista
    if (!produto) throw new Error("Produto não encontrado.");

    res.json({ retorno: { produto } });
  } catch (erro) {
    console.error("❌ Erro ao buscar produto:", erro.response?.data || erro.message);
    res.status(500).json({ mensagem: "Erro ao buscar produto." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
