import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Loader2, Plus, Search, Trash2, Upload, Users, X } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/lib/store-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · VYNKA" },
      { name: "description", content: "Base de clientes da sua loja." },
    ],
  }),
  component: Clientes,
});

type CustomerRow = {
  id: string;
  name: string;
  document: string | null;
  notes: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  telephone: string | null;
  zip_code: string | null;
  street: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
};

type CustomerForm = {
  name: string;
  document: string;
  notes: string;
  birth_date: string;
  email: string;
  mobile: string;
  telephone: string;
  zip_code: string;
  street: string;
  address_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

const EMPTY_FORM: CustomerForm = {
  name: "",
  document: "",
  notes: "",
  birth_date: "",
  email: "",
  mobile: "",
  telephone: "",
  zip_code: "",
  street: "",
  address_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

const CUSTOMER_COLUMNS =
  "id,name,document,notes,birth_date,email,phone,mobile,telephone,zip_code,street,address_number,complement,neighborhood,city,state,created_at";

function Clientes() {
  const { currentStore } = useStoreContext();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!currentStore?.id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select(CUSTOMER_COLUMNS)
        .eq("store_id", currentStore!.id)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (error) {
          console.error("[Clientes] load failed", error);
          setCustomers([]);
        } else {
          setCustomers((data ?? []) as CustomerRow[]);
        }
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentStore?.id]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.phone, c.mobile, c.telephone, c.document]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [customers, query]);

  const updateForm = (key: keyof CustomerForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setEditingCustomerId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (customer: CustomerRow) => {
    setEditingCustomerId(customer.id);
    setForm(customerToForm(customer));
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingCustomerId(null);
    setForm(EMPTY_FORM);
  };

  const lookupCep = async (value: string) => {
    const digits = value.replace(/\D/g, "");
    updateForm("zip_code", value);
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (!data?.erro) {
        setForm((current) => ({
          ...current,
          zip_code: value,
          street: data.logradouro || current.street,
          neighborhood: data.bairro || current.neighborhood,
          city: data.localidade || current.city,
          state: data.uf || current.state,
        }));
      }
    } catch (error) {
      console.error("[Clientes] CEP lookup failed", error);
    } finally {
      setCepLoading(false);
    }
  };

  const saveCustomer = async () => {
    if (!currentStore?.id || saving) return;
    setSaving(true);
    const clean = (value: string) => value.trim() || null;

    const payload = {
      store_id: currentStore.id,
      name: form.name.trim() || "Cliente sem nome",
      document: clean(form.document),
      notes: clean(form.notes),
      birth_date: clean(form.birth_date),
      email: clean(form.email),
      phone: clean(form.mobile),
      mobile: clean(form.mobile),
      telephone: clean(form.telephone),
      zip_code: clean(form.zip_code),
      street: clean(form.street),
      address_number: clean(form.address_number),
      complement: clean(form.complement),
      neighborhood: clean(form.neighborhood),
      city: clean(form.city),
      state: clean(form.state),
    };

    const request = editingCustomerId
      ? supabase
          .from("customers")
          .update(payload)
          .eq("id", editingCustomerId)
          .eq("store_id", currentStore.id)
          .select(CUSTOMER_COLUMNS)
          .single()
      : supabase.from("customers").insert(payload).select(CUSTOMER_COLUMNS).single();

    const { data, error } = await request;

    setSaving(false);
    if (error || !data) {
      alert("Não foi possível criar o cliente.");
      console.error("[Clientes] create failed", error);
      return;
    }

    setCustomers((current) =>
      editingCustomerId
        ? current.map((customer) =>
            customer.id === editingCustomerId ? (data as CustomerRow) : customer,
          )
        : [data as CustomerRow, ...current],
    );
    closeModal();
  };

  const deleteCustomer = async (customer: CustomerRow) => {
    const confirmed = window.confirm(`Excluir ${customer.name}?`);
    if (!confirmed || !currentStore?.id) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id)
      .eq("store_id", currentStore.id);

    if (error) {
      alert("Não foi possível excluir o cliente.");
      console.error("[Clientes] delete failed", error);
      return;
    }

    setCustomers((current) => current.filter((item) => item.id !== customer.id));
  };

  const exportCustomers = () => {
    const headers = [
      "Nome",
      "CPF/CNPJ",
      "Observações",
      "Data de aniversário",
      "Email",
      "Celular",
      "Telefone",
      "CEP",
      "Rua",
      "Número",
      "Complemento",
      "Bairro",
      "Cidade",
      "Estado",
    ];
    const rows = customers.map((c) => [
      c.name,
      c.document,
      c.notes,
      c.birth_date,
      c.email,
      c.mobile || c.phone,
      c.telephone,
      c.zip_code,
      c.street,
      c.address_number,
      c.complement,
      c.neighborhood,
      c.city,
      c.state,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clientes-vynka.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importCustomers = async (file: File | null) => {
    if (!file || !currentStore?.id) return;
    const text = await file.text();
    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const [, ...dataRows] = lines;
    const clean = (value: string | undefined) => value?.trim() || null;
    const payload = dataRows
      .map((line) => line.split(";").map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"')))
      .map((cells) => ({
        store_id: currentStore.id,
        name: cells[0]?.trim() || "Cliente sem nome",
        document: clean(cells[1]),
        notes: clean(cells[2]),
        birth_date: clean(cells[3]),
        email: clean(cells[4]),
        phone: clean(cells[5]),
        mobile: clean(cells[5]),
        telephone: clean(cells[6]),
        zip_code: clean(cells[7]),
        street: clean(cells[8]),
        address_number: clean(cells[9]),
        complement: clean(cells[10]),
        neighborhood: clean(cells[11]),
        city: clean(cells[12]),
        state: clean(cells[13]),
      }));

    if (payload.length === 0) return;
    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select(CUSTOMER_COLUMNS);
    if (error) {
      alert("Não foi possível importar os clientes.");
      console.error("[Clientes] import failed", error);
      return;
    }
    setCustomers((current) => ([...(data ?? [])] as CustomerRow[]).concat(current));
  };

  const initials = (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return "CL";
    return cleaned
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background">
      <AppHeader title="Clientes" />

      <main className="flex-1 px-6 py-7 md:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-[520px]">
              <Search
                className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground"
                strokeWidth={1.5}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Procure por nome"
                className="h-10 w-full rounded-md border border-border bg-background px-4 pr-12 text-[13px] outline-none placeholder:text-muted-foreground focus:border-foreground/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={exportCustomers}
                className="gap-2 text-[12.5px] font-medium"
              >
                <Upload className="h-4 w-4" strokeWidth={1.6} />
                Exportar
              </Button>
              <Button
                variant="default"
                size="icon"
                aria-label="Importar clientes"
                onClick={() => importInputRef.current?.click()}
              >
                <Download className="h-4 w-4" strokeWidth={1.7} />
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  importCustomers(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              <Button onClick={openCreate} className="gap-2 px-4 text-[12.5px]">
                <Plus className="h-4 w-4" strokeWidth={1.7} />
                Cliente
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-transparent">
            <div className="grid grid-cols-[minmax(220px,1.15fr)_minmax(180px,0.75fr)_minmax(220px,1fr)_72px] border-b border-foreground/60 px-3 py-3 text-[11px] font-medium text-muted-foreground">
              <div className="text-foreground">Nome</div>
              <div>Celular/WhatsApp</div>
              <div>E-mail</div>
              <div />
            </div>

            {loading ? (
              <div className="grid min-h-[300px] place-items-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.7} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center border-b border-border text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Users className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 text-[15px] font-medium text-foreground">
                  Nenhum cliente cadastrado
                </h3>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Crie um cliente manualmente ou aguarde os pedidos da loja.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((customer) => (
                  <div
                    key={customer.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEdit(customer)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") openEdit(customer);
                    }}
                    className="grid min-h-[70px] cursor-pointer grid-cols-[minmax(220px,1.15fr)_minmax(180px,0.75fr)_minmax(220px,1fr)_72px] items-center px-3 text-[13px] transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-graphite text-[13px] font-medium text-white">
                        {initials(customer.name)}
                      </div>
                      <span className="truncate font-medium text-foreground">{customer.name}</span>
                    </div>
                    <div className="truncate font-medium text-primary">
                      {customer.mobile || customer.phone || "—"}
                    </div>
                    <div className="truncate text-foreground/80">{customer.email || "—"}</div>
                    <div>
                      <button
                        type="button"
                        aria-label="Excluir cliente"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteCustomer(customer);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-md bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-[17px] font-medium text-foreground">
                  {editingCustomerId ? "Editar cliente" : "Novo cliente"}
                </h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {editingCustomerId
                    ? "Atualize os dados do cliente para vendas e pedidos."
                    : "Cadastre os dados do cliente para usar em vendas e pedidos."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fechar"
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-6">
                <FormSection title="Dados Pessoais">
                  <TextField
                    label="Nome"
                    value={form.name}
                    onChange={(value) => updateForm("name", value)}
                  />
                  <TextField
                    label="CPF/CNPJ"
                    value={form.document}
                    onChange={(value) => updateForm("document", value)}
                  />
                  <TextField
                    label="Data de aniversário"
                    type="date"
                    value={form.birth_date}
                    onChange={(value) => updateForm("birth_date", value)}
                  />
                  <label className="md:col-span-3">
                    <span className="mb-1.5 block text-[12px] text-foreground">Observações</span>
                    <textarea
                      value={form.notes}
                      onChange={(event) => updateForm("notes", event.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                    />
                  </label>
                </FormSection>

                <FormSection title="Contato">
                  <TextField
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(value) => updateForm("email", value)}
                  />
                  <TextField
                    label="Celular"
                    value={form.mobile}
                    onChange={(value) => updateForm("mobile", value)}
                  />
                  <TextField
                    label="Telefone"
                    value={form.telephone}
                    onChange={(value) => updateForm("telephone", value)}
                  />
                </FormSection>

                <FormSection title="Endereço">
                  <TextField label="CEP" value={form.zip_code} onChange={lookupCep} />
                  <TextField
                    label="Rua"
                    value={form.street}
                    onChange={(value) => updateForm("street", value)}
                  />
                  <TextField
                    label="Número"
                    value={form.address_number}
                    onChange={(value) => updateForm("address_number", value)}
                  />
                  <TextField
                    label="Complemento"
                    value={form.complement}
                    onChange={(value) => updateForm("complement", value)}
                  />
                  <TextField
                    label="Bairro"
                    value={form.neighborhood}
                    onChange={(value) => updateForm("neighborhood", value)}
                  />
                  <TextField
                    label="Cidade"
                    value={form.city}
                    onChange={(value) => updateForm("city", value)}
                  />
                  <TextField
                    label="Estado"
                    value={form.state}
                    onChange={(value) => updateForm("state", value.toUpperCase().slice(0, 2))}
                  />
                  {cepLoading && (
                    <div className="flex items-center gap-2 self-end pb-2 text-[12px] text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
                      Buscando CEP
                    </div>
                  )}
                </FormSection>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={closeModal} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={saveCustomer} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.7} />}
                {editingCustomerId ? "Salvar alterações" : "Criar cliente"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h3 className="text-[14px] font-medium text-foreground">{title}</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className={cn("block", type === "date" && "max-md:max-w-none")}>
      <span className="mb-1.5 block text-[12px] text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] outline-none focus:border-foreground/40"
      />
    </label>
  );
}

function customerToForm(customer: CustomerRow): CustomerForm {
  return {
    name: customer.name ?? "",
    document: customer.document ?? "",
    notes: customer.notes ?? "",
    birth_date: customer.birth_date ?? "",
    email: customer.email ?? "",
    mobile: customer.mobile ?? customer.phone ?? "",
    telephone: customer.telephone ?? "",
    zip_code: customer.zip_code ?? "",
    street: customer.street ?? "",
    address_number: customer.address_number ?? "",
    complement: customer.complement ?? "",
    neighborhood: customer.neighborhood ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
  };
}

function csvCell(value: string | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
