const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

let accessToken = "";

console.log("🚀 Servidor iniciando...");

app.get("/auth", (req, res) => {
  const state = Math.random().toString(36).substring(2);
  const redirectUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${process.env.BLING_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=produtos_write&state=${state}`;
  res.redirect(redirectUrl);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Código de autorização ausente.");
  }

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

    res.redirect("https://atualizador-site.vercel.app/");
  } catch (erro) {
    console.error("❌ Erro ao obter token:", erro.response?.data || erro.message);
    res.status(500).send("Erro ao autenticar.");
  }
});

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

    const produto = resposta.data?.data?.[0];
    if (!produto) throw new Error("Produto não encontrado.");

    const localizacao = produto.depositos?.[0]?.localizacao || "Não informada";

    res.json({ retorno: { produto, localizacao } });
  } catch (erro) {
    console.error("❌ Erro ao buscar produto:", erro.response?.data || erro.message);
    res.status(500).json({ mensagem: "Erro ao buscar produto." });
  }
});

app.post("/atualizar-localizacao", async (req, res) => {
  const { produtoId, localizacao } = req.body;

  if (!accessToken) {
    return res.status(403).json({ mensagem: "Token de acesso não encontrado. Faça login via /auth." });
  }

  try {
    const respostaBusca = await axios.get(`https://www.bling.com.br/Api/v3/produtos/${produtoId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const produtoAtual = respostaBusca.data?.data;

    if (!produtoAtual) {
      return res.status(404).json({ mensagem: "Produto não encontrado." });
    }

    const produtoAtualizado = {
      nome: produtoAtual.nome || "Produto sem nome",
      codigo: produtoAtual.codigo,
      preco: produtoAtual.preco,
      unidade: produtoAtual.unidade || "un",
      situacao: produtoAtual.situacao || "A",
      descricao: produtoAtual.descricao || "",
      estoque: produtoAtual.estoque || 0,
      formato: produtoAtual.formato || "S",
      tipo: produtoAtual.tipo || "P",
      depositos: [
        {
          depositoId: 1,
          localizacao: localizacao
        }
      ]
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
