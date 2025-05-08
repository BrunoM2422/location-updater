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

const USUARIO = "msestoque@magisol";
const SENHA = "msestoque@2025";

app.get("/", (req, res) => {
  if (!logado) return res.redirect("/login");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

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

app.get("/auth", (req, res) => {
  const state = Math.random().toString(36).substring(2);
  const redirectUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${process.env.BLING_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=produtos_write&state=${state}`;
  res.redirect(redirectUrl);
});

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
    console.log("✅ Token recebido!");
    res.redirect("/login");
  } catch (erro) {
    console.error("❌ Erro ao obter token:", erro.response?.data || erro.message);
    res.status(500).send("Erro ao autenticar.");
  }
});

app.get("/buscar-produto/:tipo/:codigo", async (req, res) => {
  const { tipo, codigo } = req.params;
  if (!accessToken) return res.status(403).json({ mensagem: "Faça login via /auth." });

  try {
    let resposta;
    let produtoResumo;

    if (tipo === "ean") {
      resposta = await axios.get(`https://www.bling.com.br/Api/v3/produtos?gtin=${codigo}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } else {
      resposta = await axios.get(`https://www.bling.com.br/Api/v3/produtos?sku=${codigo}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }

    produtoResumo = resposta.data?.data?.[0];
    if (!produtoResumo) throw new Error("Produto não encontrado.");

    const detalhes = await axios.get(`https://www.bling.com.br/Api/v3/produtos/${produtoResumo.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const produtoCompleto = detalhes.data?.data;

    const localizacao = produtoCompleto.estoque?.localizacao || "";
    const primeiraImagem = produtoCompleto.midia?.imagens?.externas?.[0]?.link || null;
    const quantidadeEstoque = produtoCompleto.estoque?.saldoVirtualTotal ?? 0;

    res.json({
      retorno: {
        produto: {
          id: produtoResumo.id,
          nome: produtoResumo.nome,
          localizacao,
          imagem: primeiraImagem,
          quantidade: quantidadeEstoque,
        },
      },
    });
  } catch (erro) {
    console.error("❌ Erro ao buscar produto:", erro.response?.data || erro.message);
    res.status(404).json({ mensagem: "Produto não encontrado." });
  }
});


app.post("/atualizar-localizacao", async (req, res) => {
  const { produtoId, localizacao } = req.body;

  if (!accessToken) {
    return res.status(403).json({ mensagem: "Faça login via /auth." });
  }

  if (!produtoId || typeof localizacao !== "string") {
    return res.status(400).json({ mensagem: "Dados inválidos." });
  }

  try {
    // 1) Busca o produto completo
    const resp = await axios.get(
      `https://www.bling.com.br/Api/v3/produtos/${produtoId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const produtoAtual = resp.data?.data;
    if (!produtoAtual) {
      return res.status(404).json({ mensagem: "Produto não encontrado." });
    }

    const {
      camposCustomizados, // <-- provável vilão
      info,               // <-- metadados internos do Bling
      ...dadosLimpos
    } = produtoAtual;
    
    const payload = {
      ...dadosLimpos,
      estoque: {
        ...(produtoAtual.estoque || {}),
        localizacao
      }
    };
    

    // 3) Atualiza o produto com o corpo completo preservado
    await axios.put(
      `https://www.bling.com.br/Api/v3/produtos/${produtoId}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.json({ mensagem: "Localização atualizada com sucesso!" });

  } catch (erro) {
    const detalhe = erro.response?.data || erro.message;
    console.error("❌ Erro ao atualizar localização:", detalhe);
    if (detalhe.error?.fields) {
      detalhe.error.fields.forEach((f, i) =>
        console.error(`🔍 Field ${i + 1}:`, f)
      );
    }
    return res.status(500).json({
      mensagem: "Erro ao atualizar localização.",
      detalhe
    });
  }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
