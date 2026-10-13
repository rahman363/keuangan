
const $ = id => document.getElementById(id);

const categories = {
    masuk: [
        "Gaji", "Hasil Kerja", "Freelance", "Bisnis",
        "Affiliate", "Bonus", "Hadiah", "Lainnya"
    ],
    keluar: [
        "Makan & Minum", "Transportasi", "Kopi",
        "Belanja", "Pulsa & Internet", "Cicilan & Utang",
        "Kebutuhan Rumah", "Hiburan", "Kesehatan",
        "Tabungan", "Investasi", "Sedekah", "Lainnya"
    ]
};

const STORAGE_KEY = "bukuKeuanganHarian_v1";
let transactions = [];
let editingId = null;

// Memuat data dari browser
try {
    const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
    );

    transactions = Array.isArray(saved)
        ? saved.filter(t =>
            t &&
            typeof t.id === "string" &&
            typeof t.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
            ["masuk", "keluar"].includes(t.type) &&
            typeof t.amount === "number" &&
            Number.isSafeInteger(t.amount) &&
            t.amount > 0 &&
            typeof t.description === "string" &&
            typeof t.category === "string"
        )
        : [];
} catch {
    transactions = [];
}

// Tanggal hari ini
function today() {
    const d = new Date();

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonth() {
    return today().slice(0, 7);
}

// Format rupiah
function rupiah(n) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(n);
}

// Simpan data
function saveData() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(transactions)
        );
        return true;
    } catch {
        alert("Data gagal disimpan. Periksa penyimpanan browser.");
        return false;
    }
}

// Memperbarui kategori
function updateCategories(selected = "") {
    const type = $("type").value;
    $("category").replaceChildren();

    categories[type].forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        $("category").appendChild(option);
    });

    if (categories[type].includes(selected)) {
        $("category").value = selected;
    }
}

// Menghitung pemasukan atau pengeluaran
function sum(items, type) {
    return items
        .filter(t => t.type === type)
        .reduce((total, t) => total + t.amount, 0);
}

// Membuat sel tabel dengan aman
function addCell(row, text, className = "") {
    const td = document.createElement("td");
    td.textContent = text;

    if (className) {
        td.className = className;
    }

    row.appendChild(td);
    return td;
}

// Menampilkan dashboard dan riwayat
function render() {
    const month = $("filterMonth").value || currentMonth();

    const monthly = transactions.filter(
        t => t.date.startsWith(month)
    );

    const totalIn = sum(monthly, "masuk");
    const totalOut = sum(monthly, "keluar");

    const balance =
        sum(transactions, "masuk") -
        sum(transactions, "keluar");

    $("balance").textContent = rupiah(balance);
    $("income").textContent = rupiah(totalIn);
    $("expense").textContent = rupiah(totalOut);
    $("count").textContent = `${monthly.length} transaksi`;

    $("net").textContent = rupiah(totalIn - totalOut);
    $("net").className =
        totalIn - totalOut >= 0 ? "income" : "expense";

    const list = $("transactionList");
    list.replaceChildren();

    [...monthly]
        .sort((a, b) =>
            b.date.localeCompare(a.date) ||
            b.id.localeCompare(a.id)
        )
        .forEach(t => {
            const row = document.createElement("tr");

            addCell(row, t.date);
            addCell(row, t.description);
            addCell(row, t.category);

            const amount =
                t.type === "masuk" ? t.amount : -t.amount;

            addCell(
                row,
                (amount > 0 ? "+" : "") + rupiah(amount),
                "amount " + (amount > 0 ? "income" : "expense")
            );

            const actions = addCell(row, "");

            const edit = document.createElement("button");
            edit.textContent = "Edit";
            edit.type = "button";
            edit.addEventListener("click", () => editTransaction(t.id));

            const del = document.createElement("button");
            del.textContent = "Hapus";
            del.type = "button";
            del.className = "danger";
            del.style.marginLeft = "5px";
            del.addEventListener("click", () => deleteTransaction(t.id));

            actions.append(edit, del);
            list.appendChild(row);
        });

    if (monthly.length === 0) {
        const row = document.createElement("tr");
        const cell = addCell(
            row,
            "Belum ada transaksi pada bulan ini."
        );
        cell.colSpan = 5;
        cell.className = "empty";
        list.appendChild(row);
    }

    $("transactionCount").textContent =
        `Menampilkan ${monthly.length} transaksi untuk ${month}.`;
}

// Reset formulir
function resetForm() {
    editingId = null;
    $("transactionForm").reset();
    $("date").value = today();
    $("type").value = "masuk";
    updateCategories();

    $("formTitle").textContent = "Tambah Transaksi";
    $("saveButton").textContent = "Simpan Transaksi";
    $("cancelEdit").hidden = true;
}

// Ganti kategori saat jenis transaksi berubah
$("type").addEventListener("change", () => updateCategories());
$("filterMonth").addEventListener("change", render);

// Simpan transaksi baru atau perubahan
$("transactionForm").addEventListener("submit", event => {
    event.preventDefault();

    const date = $("date").value;
    const type = $("type").value;
    const category = $("category").value;
    const description = $("description").value.trim();
    const amount = Number($("amount").value);

    if (
        !date ||
        !description ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        !categories[type].includes(category)
    ) {
        alert("Periksa kembali data transaksi.");
        return;
    }

    const previous = editingId
        ? transactions.find(t => t.id === editingId)
        : null;

    const transaction = {
        id: editingId || (
            Date.now().toString(36) +
            Math.random().toString(36).slice(2)
        ),
        date,
        type,
        category,
        description,
        amount
    };

    if (editingId) {
        transactions = transactions.map(t =>
            t.id === editingId ? transaction : t
        );
    } else {
        transactions.push(transaction);
    }

    if (!saveData()) {
        if (previous) {
            transactions = transactions.map(t =>
                t.id === previous.id ? previous : t
            );
        } else {
            transactions = transactions.filter(
                t => t.id !== transaction.id
            );
        }
        return;
    }

    $("filterMonth").value = date.slice(0, 7);
    resetForm();
    render();
});

// Mengedit transaksi
function editTransaction(id) {
    const t = transactions.find(item => item.id === id);
    if (!t) return;

    editingId = id;

    $("date").value = t.date;
    $("type").value = t.type;
    updateCategories(t.category);
    $("description").value = t.description;
    $("amount").value = t.amount;

    $("formTitle").textContent = "Edit Transaksi";
    $("saveButton").textContent = "Simpan Perubahan";
    $("cancelEdit").hidden = false;

    $("transactionForm").scrollIntoView({
        behavior: "smooth"
    });
}

// Menghapus transaksi
function deleteTransaction(id) {
    if (!confirm("Yakin ingin menghapus transaksi ini?")) {
        return;
    }

    const old = transactions;
    transactions = transactions.filter(t => t.id !== id);

    if (!saveData()) {
        transactions = old;
        return;
    }

    if (editingId === id) {
        resetForm();
    }

    render();
}

$("cancelEdit").addEventListener("click", resetForm);

// Ekspor transaksi bulanan ke CSV
$("exportButton").addEventListener("click", () => {
    const month = $("filterMonth").value || currentMonth();

    const rows = transactions
        .filter(t => t.date.startsWith(month))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length === 0) {
        alert("Tidak ada transaksi untuk diekspor.");
        return;
    }

    const quote = value =>
        '"' + String(value).replace(/"/g, '""') + '"';

    const csv = [
        ["Tanggal", "Jenis", "Kategori", "Keterangan", "Nominal"],
        ...rows.map(t => [
            t.date,
            t.type,
            t.category,
            t.description,
            t.amount
        ])
    ]
        .map(row => row.map(quote).join(";"))
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `keuangan-${month}.csv`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Inisialisasi aplikasi
$("date").value = today();
$("filterMonth").value = currentMonth();

updateCategories();
render();
