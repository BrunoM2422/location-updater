const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
  secret: "chave-super-secreta",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hora
}));

// ========== VARIÁVEIS ==========
const USUARIO = "admin";
const SENHA = "1234";
let accessToken = null;
let tokenExpiraEm = null;

// ========== MIDDLEWARE DE AUTENTICAÇÃO ==========
function autenticado(req, res, next) {
  if (req.session.logado) return next();
  return res.redirect("/login");
}

// ========== ROTAS ==========
app.get("/", autenticado, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === USUARIO && senha === SENHA) {
    req.session.logado = true;
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
    const expiresIn = resposta.data.expires_in;
    tokenExpiraEm = Date.now() + expiresIn * 1000;

    console.log("✅ Token recebido!");
    res.redirect("/");
  } catch (erro) {
    console.error("❌ Erro ao obter token:", erro.response?.data || erro.message);
    res.status(500).send("Erro ao autenticar.");
  }
});

// ========== FUNÇÃO DE VERIFICAÇÃO DE TOKEN ==========
function verificarTokenValido() {
  return accessToken && tokenExpiraEm && Date.now() < tokenExpiraEm;
}

// ========== BUSCAR PRODUTO ==========
app.get("/buscar-produto", async (req, res) => {
  const { tipo, valor } = req.query;
  if (!verificarTokenValido()) return res.status(403).json({ mensagem: "Faça login via /auth." });

  const valorSanitizado = String(valor).trim();

  try {
    let produtoResumo = null;

    if (tipo === "sku") {
      // Busca direta por SKU
      const resposta = await axios.get(`https://www.bling.com.br/Api/v3/produtos?sku=${valorSanitizado}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      produtoResumo = resposta.data?.data?.[0];

    } else if (tipo === "ean") {
      // Busca por EAN com paginação
      let pagina = 1;
      let achou = false;

      while (!achou) {
        const resposta = await axios.get(`https://www.bling.com.br/Api/v3/produtos?page=${pagina}&limit=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const produtos = resposta.data?.data || [];

        produtoResumo = produtos.find(p => p.gtin?.trim() === valorSanitizado);
        if (produtoResumo) {
          achou = true;
          break;
        }

        if (produtos.length < 100) break; // Última página
        pagina++;
      }
    } else {
      return res.status(400).json({ mensagem: "Tipo de busca inválido." });
    }

    if (!produtoResumo) {
      return res.status(404).json({ mensagem: "Produto não encontrado." });
    }

    // Buscar detalhes
    const detalhes = await axios.get(`https://www.bling.com.br/Api/v3/produtos/${produtoResumo.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const produtoCompleto = detalhes.data?.data;
    const localizacao = produtoCompleto.estoque?.localizacao || "";
    const imagens = produtoCompleto.imagens || [];
    let primeiraImagem = imagens[0]?.link || null;

    // Corrigir imagem do Google Drive
    if (primeiraImagem?.includes("lh3.googleusercontent.com/d/")) {
      const match = primeiraImagem.match(/\/d\/([^/]+)/);
      if (match && match[1]) {
        const id = match[1];
        primeiraImagem = `https://drive.google.com/uc?id=${id}`;
      }
    }

    res.json({
      retorno: {
        produto: {
          id: produtoResumo.id,
          nome: produtoResumo.nome,
          localizacao,
          imagem: primeiraImagem,
        },
      },
    });

  } catch (erro) {
    console.error("❌ Erro ao buscar produto:", erro.response?.data || erro.message);
    res.status(500).json({ mensagem: "Erro ao buscar produto." });
  }
});

app.post("/atualizar-localizacao", async (req, res) => {
  const { produtoId, localizacao } = req.body;
  if (!accessToken) return res.status(403).json({ mensagem: "Faça login via /auth." });
  if (!produtoId || typeof localizacao !== "string") return res.status(400).json({ mensagem: "Dados inválidos." });

  try {
    const respostaBusca = await axios.get(`https://www.bling.com.br/Api/v3/produtos/${produtoId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const produtoAtual = respostaBusca.data?.data;
    if (!produtoAtual) throw new Error("Produto não encontrado.");

    // Preparar somente os dados necessários para o PUT
    const produtoAtualizado = {
      nome: produtoAtual.nome,
      tipo: produtoAtual.tipo,
      situacao: produtoAtual.situacao,
      unidade: produtoAtual.unidade || "UN",
      preco: produtoAtual.preco,
      precoCusto: produtoAtual.precoCusto,
      codigo: produtoAtual.codigo,
      descricao: produtoAtual.descricao || "",
      gtin: produtoAtual.gtin || "",
      marca: produtoAtual.marca || "",
      categoria: produtoAtual.categoria?.id ? { id: produtoAtual.categoria.id } : undefined,
      estoque: {
        ...produtoAtual.estoque,
        localizacao: localizacao,
      },
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



// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
