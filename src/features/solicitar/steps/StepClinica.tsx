import { useEffect, useRef, useState } from "react";
import { SelectField, TextField } from "../../../components/fields";
import { UFS } from "../../../shared/schema";
import { onlyDigits } from "../../../shared/validators";
import { lookupCep, maskCep, maskCnpj, maskPhone } from "../masks";
import type { StepProps } from "./types";

export function StepClinica({ state, patch, errors }: StepProps) {
  const c = state.clinica;
  const set = (field: keyof typeof c) => (v: string) => patch("clinica", { [field]: v });
  const err = (f: string) => errors[`clinica.${f}`];
  const [cepStatus, setCepStatus] = useState<"" | "buscando" | "nao-encontrado">("");
  const numeroRef = useRef<HTMLInputElement>(null);
  const lastCep = useRef(onlyDigits(c.cep));

  useEffect(() => {
    const digits = onlyDigits(c.cep);
    if (digits.length !== 8 || digits === lastCep.current) return;
    lastCep.current = digits;
    const ctrl = new AbortController();
    setCepStatus("buscando");
    lookupCep(digits, ctrl.signal)
      .then((r) => {
        if (!r) return setCepStatus("nao-encontrado");
        setCepStatus("");
        patch("clinica", { rua: r.rua || c.rua, bairro: r.bairro || c.bairro, cidade: r.cidade, estado: r.estado });
        if (r.rua) numeroRef.current?.focus();
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setCepStatus("nao-encontrado");
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.cep]);

  return (
    <>
      <div className="grid">
        <TextField className="col-6" label="Razão social" required value={c.razaoSocial} onValue={set("razaoSocial")} error={err("razaoSocial")} autoComplete="organization" />
        <TextField className="col-3" label="Nome fantasia" required value={c.nomeFantasia} onValue={set("nomeFantasia")} error={err("nomeFantasia")} />
        <TextField className="col-3" label="CNPJ" required value={c.cnpj} onValue={(v) => patch("clinica", { cnpj: maskCnpj(v) })} error={err("cnpj")} inputMode="numeric" placeholder="00.000.000/0000-00" />
        <TextField className="col-3" label="Inscrição municipal" value={c.inscricaoMunicipal} onValue={set("inscricaoMunicipal")} />
        <TextField className="col-3" label="Instagram" value={c.instagram} onValue={set("instagram")} placeholder="@" />
      </div>

      <section className="group" aria-labelledby="g-resp">
        <div className="group-title"><h3 id="g-resp">Responsável</h3></div>
        <div className="grid">
          <TextField className="col-4" label="Cirurgião-dentista solicitante" required value={c.solicitante} onValue={set("solicitante")} error={err("solicitante")} autoComplete="name" />
          <TextField className="col-2" label="CRO" value={c.cro} onValue={set("cro")} placeholder="CRO-UF 00000" />
          <TextField className="col-3" label="WhatsApp" required value={c.whatsapp} onValue={(v) => patch("clinica", { whatsapp: maskPhone(v) })} error={err("whatsapp")} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" />
          <TextField className="col-3" label="Telefone" value={c.telefone} onValue={(v) => patch("clinica", { telefone: maskPhone(v) })} error={err("telefone")} inputMode="tel" placeholder="(00) 0000-0000" />
          <TextField className="col-3" label="E-mail" required type="email" value={c.email} onValue={set("email")} error={err("email")} autoComplete="email" hint="A confirmação da solicitação será enviada para este endereço." />
          <TextField className="col-3" label="E-mail para nota fiscal" type="email" value={c.emailNotaFiscal} onValue={set("emailNotaFiscal")} error={err("emailNotaFiscal")} />
        </div>
      </section>

      <section className="group" aria-labelledby="g-end">
        <div className="group-title"><h3 id="g-end">Endereço</h3></div>
        <div className="grid">
          <TextField
            className="col-2"
            label="CEP"
            required
            value={c.cep}
            onValue={(v) => patch("clinica", { cep: maskCep(v) })}
            error={err("cep") ?? (cepStatus === "nao-encontrado" ? "CEP não encontrado — preencha o endereço manualmente" : undefined)}
            hint={cepStatus === "buscando" ? "Buscando endereço…" : undefined}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
          />
          <TextField className="col-4" label="Rua" required value={c.rua} onValue={set("rua")} error={err("rua")} autoComplete="address-line1" />
          <TextField ref={numeroRef} className="col-2" label="Número" required value={c.numero} onValue={set("numero")} error={err("numero")} />
          <TextField className="col-4" label="Complemento" value={c.complemento} onValue={set("complemento")} autoComplete="address-line2" />
          <TextField className="col-2" label="Bairro" required value={c.bairro} onValue={set("bairro")} error={err("bairro")} />
          <TextField className="col-2" label="Cidade" required value={c.cidade} onValue={set("cidade")} error={err("cidade")} autoComplete="address-level2" />
          <SelectField className="col-2" label="Estado" required value={c.estado} onValue={set("estado")} error={err("estado")}>
            <option value="">—</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </SelectField>
        </div>
      </section>
    </>
  );
}
