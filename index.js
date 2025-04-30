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

// Callback - troca o código pelo token
app.get("/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) return res.status(400).send("Código de autorização ausente.");

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

// Buscar produto pelo SKU
app.get("/buscar-produto/:sku", async (req, res) => {
  const { sku } = req.params;

  if (!accessToken) {
    return res.status(403).json({ mensagem: "Token de acesso não encontrado. Faça login via /auth." });
  }

  try {
    const resposta = await axios.get(`https://www.bling.com.br/Api/v3/produtos?sku=${sku}&completo=true`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const produto = resposta.data?.data?.[0];

    if (!produto) {
      return res.status(404).json({ mensagem: "Produto não encontrado." });
    }

    const deposito = produto.depositos?.[0] || {};

    const produtoFormatado = {
      id: produto.id,
      nome: produto.nome || "Sem nome",
      preco: produto.preco || produto.precoVenda || "0",
      imagem: produto.imagem?.link || null,
      unidade: produto.unidade || "un",
      localizacao: deposito.localizacao || "Não informada",
      estoque: deposito.quantidade || 0,
      depositoId: deposito.depositoId || null
    };

    res.json({ retorno: { produto: produtoFormatado } });

  } catch (erro) {
    console.error("❌ Erro ao buscar produto:", erro.response?.data || erro.message);
    res.status(500).json({ mensagem: "Erro ao buscar produto." });
  }
});

// Atualizar localização do produto
app.post("/atualizar-localizacao", async (req, res) => {
  const { produtoId, localizacao, depositoId } = req.body;

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

    let depositos = produtoAtual.depositos || [];

    const index = depositos.findIndex(d => d.depositoId == depositoId);

    if (index >= 0) {
      depositos[index].localizacao = localizacao;
    } else {
      depositos.push({ depositoId: parseInt(depositoId), localizacao, quantidade: 0 });
    }

    const produtoAtualizado = {
      nome: produtoAtual.nome,
      codigo: produtoAtual.codigo,
      preco: produtoAtual.preco,
      unidade: produtoAtual.unidade,
      situacao: produtoAtual.situacao,
      descricao: produtoAtual.descricao || "",
      estoque: produtoAtual.estoque || 0,
      formato: produtoAtual.formato || "S",
      tipo: produtoAtual.tipo || "P",
      depositos
    };

    await axios.put(`https://www.bling.com.br/Api/v3/produtos/${produtoId}`, produtoAtualizado, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    res.json({ mensagem: "Localização atualizada com sucesso!" });

  } catch (erro) {
    console.error("❌ Erro ao atualizar localização:", erro.response?.data || erro.message);
    res.status(500).json({ mensagem: "Erro ao atualizar localização." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
