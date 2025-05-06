const apiBaseUrl = ""; // Deixe vazio se estiver no mesmo domínio

const formBuscar = document.getElementById("form-buscar");
const formAtualizar = document.getElementById("form-atualizar");

let produtoId = null;

formBuscar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const tipoBusca = document.getElementById("tipo-busca").value;
  const valorBusca = document.getElementById("valor-busca").value.trim();

  if (!valorBusca) {
    alert("Informe um valor para busca.");
    return;
  }

  try {
    const resposta = await fetch(`${apiBaseUrl}/buscar-produto?tipo=${tipoBusca}&valor=${encodeURIComponent(valorBusca)}`);
    const dados = await resposta.json();

    const produto = dados.retorno?.produto;

    if (!produto) {
      alert("Produto não encontrado.");
      return;
    }

    document.getElementById("info-produto").style.display = "block";
    document.getElementById("nome-produto").innerText = produto.nome;
    document.getElementById("localizacao-atual").innerText = produto.localizacao?.trim() || "(vazio)";

    const imagemEl = document.getElementById("imagem-produto");

    if (produto.imagem && produto.imagem.startsWith("http")) {
      imagemEl.src = produto.imagem;
      imagemEl.alt = "Imagem do Produto";
      imagemEl.style.display = "block";
    } else {
      imagemEl.src = "";
      imagemEl.alt = "Imagem não disponível";
      imagemEl.style.display = "none";
    }

    produtoId = produto.id;
    document.getElementById("mensagem").innerText = "";

  } catch (erro) {
    console.error(erro);
    alert("Erro ao buscar produto!");
  }
});

formAtualizar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const localizacao = document.getElementById("localizacao").value.trim();

  if (!produtoId) {
    alert("Nenhum produto selecionado!");
    return;
  }

  if (!localizacao) {
    alert("Digite a nova localização.");
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

    if (!resposta.ok) {
      throw new Error(dados.mensagem || "Erro ao atualizar.");
    }

    document.getElementById("mensagem").innerText = dados.mensagem;
    document.getElementById("localizacao-atual").innerText = localizacao;
  } catch (erro) {
    console.error(erro);
    alert("Erro ao atualizar localização!");
  }
});
