const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

let accessToken = "";

console.log("🚀 Servidor iniciando...");

// Rota para redirecionar o usuário para o consentimento do Bling
app.get("/auth", (req, res) => {
  const redirectUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${process.env.BLING_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=produtos_write`;
  res.redirect(redirectUrl);
});

// Rota de callback - troca o código pelo token
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

    res.send("Autenticação concluída com sucesso!");
  } catch (erro) {
    console.error("❌ Erro ao obter token:", erro.response?.data || erro.message);
    res.status(500).send("Erro ao autenticar.");
  }
});

// Atualizar localização do produto
app.post("/atualizar-localizacao", async (req, res) => {
  const { sku, localizacao, depositoId } = req.body;

  if (!accessToken) {
    return res.status(403).json({ mensagem: "Token de acesso não encontrado. Faça login via /auth." });
  }

  try {
    const resposta = await axios.patch(
      `https://www.bling.com.br/Api/v3/produtos/${sku}`,
      {
        depositos: [{ id: depositoId, localizacao }],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application
