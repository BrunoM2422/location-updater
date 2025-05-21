const apiBaseUrl = "https://location-updater.onrender.com";

const formBuscar = document.getElementById("form-buscar");
const formAtualizar = document.getElementById("form-atualizar");

let produtoId = null;

formBuscar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const tipo = document.getElementById("tipo-codigo").value;
  const codigo = document.getElementById("codigo").value.trim();

  document.getElementById("mensagem").innerText = "";

  try {
    const resposta = await fetch(`${apiBaseUrl}/buscar-produto/${tipo}/${codigo}`);
    const dados = await resposta.json();

    console.log("📦 Dados recebidos:", dados);

    const produto = dados.retorno.produto;
    produtoId = produto.id;

    document.getElementById("info-produto").style.display = "block";
    document.getElementById("nome-produto").innerText = produto.nome;
    document.getElementById("localizacao-atual").innerText = produto.localizacao?.trim() || "(vazio)";
    document.getElementById("quantidade-produto").innerText = produto.quantidade ?? "(indisponível)";
    document.getElementById("localizacao").value = "";

    const imagemEl = document.getElementById("imagem-produto");
    imagemEl.alt = "Imagem do Produto";

    const midia = produto.midia?.imagens || {};
    let imagemUrl = "";

    if (midia.externas?.length > 0) {
      imagemUrl = midia.externas[0].url || midia.externas[0].urlImagem;
    } else if (midia.internas?.length > 0) {
      imagemUrl = midia.internas[0].link;
    } else if (midia.anexos?.length > 0) {
      imagemUrl = `${apiBaseUrl}/imagem-produto/${produto.id}/${midia.anexos[0].id}`;
    }

    if (imagemUrl) {
      imagemEl.src = imagemUrl;
      imagemEl.style.display = "block";
    } else {
      imagemEl.src = "";
      imagemEl.alt = "Imagem não disponível";
      imagemEl.style.display = "none";
    }

  } catch (erro) {
    console.error("❌ Erro ao buscar produto:", erro);
    alert("Erro ao buscar produto!");
  }
});

formAtualizar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const localizacao = document.getElementById("localizacao").value;

  if (!produtoId) {
    alert("Nenhum produto selecionado!");
    return;
  }

  try {
    const resposta = await fetch(`${apiBaseUrl}/atualizar-localizacao`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ produtoId, localizacao }),
    });

    const dados = await resposta.json();
    document.getElementById("mensagem").innerText = dados.mensagem;
    document.getElementById("localizacao-atual").innerText = localizacao;
  } catch (erro) {
    console.error("❌ Erro ao atualizar localização:", erro);
    alert("Erro ao atualizar localização!");
  }
});
