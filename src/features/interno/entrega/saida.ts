/**
 * Saída do PDF gerado: pré-visualização e download, sempre no próprio
 * computador de quem planeja. Nada é enviado. (Uma versão alternativa deste
 * módulo pode ser usada em outros ambientes de exibição, com a mesma interface.)
 */

const urls: string[] = [];
const blobUrl = (bytes: Uint8Array) => {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }));
  urls.push(url);
  return url;
};

export interface Preview {
  /** Mostra o PDF. Devolve um link quando a nova aba foi bloqueada. */
  mostrar(bytes: Uint8Array): Promise<string | void>;
  cancelar(): void;
}

/** Chamar no clique, antes de gerar: a aba precisa abrir no gesto (bloqueio de pop-up). */
export function iniciarPreview(): Preview {
  const win = window.open("", "_blank");
  if (win) win.document.title = "Gerando PDF…";
  return {
    async mostrar(bytes) {
      const url = blobUrl(bytes);
      if (win) win.location.href = url;
      else return url;
    },
    cancelar: () => win?.close(),
  };
}

/** Baixa o arquivo. Devolve false se a pessoa recusar o download. */
export async function baixar(nome: string, bytes: Uint8Array): Promise<boolean> {
  const a = document.createElement("a");
  a.href = blobUrl(bytes);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export function liberarPdfs() {
  urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
}
