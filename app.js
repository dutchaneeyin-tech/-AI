

const WEB_APP_URL = https://script.google.com/macros/s/AKfycbxoB4JSQEPJ4fgwyIzMOes-QGgg8OdcGGK2rmpGydzUfUbbz9JiY59kSZ4Di2QNzWW4/exec;

let debtors = [];
let editingId = null;
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", function () {
    updateDateTime();
    setInterval(updateDateTime, 1000);

    loadDebtors();

    document.getElementById("debtor-form").addEventListener("submit", saveDebtor);
    document.getElementById("reset-btn").addEventListener("click", resetForm);
    document.getElementById("search-input").addEventListener("input", renderDebtors);

    document.querySelectorAll(".status-select-btn").forEach(btn => {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".status-select-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            document.getElementById("debtor-status").value = this.dataset.status;
        });
    });

    document.querySelectorAll(".filter-tab").forEach(btn => {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentFilter = this.dataset.filter;
            renderDebtors();
        });
    });
});

function updateDateTime() {
    const now = new Date();

    const dateEl = document.getElementById("currentDate");
    const timeEl = document.getElementById("currentTime");

    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }) + " น.";
    }
}

async function loadDebtors() {
    try {
        if (!WEB_APP_URL || WEB_APP_URL.includes("วางลิงก์")) {
            debtors = JSON.parse(localStorage.getItem("debtors")) || [];
            renderDebtors();
            updateDashboard();
            return;
        }

        const response = await fetch(WEB_APP_URL);
        const data = await response.json();

        debtors = Array.isArray(data) ? data : [];
        localStorage.setItem("debtors", JSON.stringify(debtors));

        renderDebtors();
        updateDashboard();

    } catch (error) {
        console.error(error);
        debtors = JSON.parse(localStorage.getItem("debtors")) || [];
        renderDebtors();
        updateDashboard();
    }
}

async function saveDebtor(e) {
    e.preventDefault();

    const name = document.getElementById("debtor-name").value.trim();
    const phone = document.getElementById("debtor-phone").value.trim();
    const dueDate = document.getElementById("debtor-due-date").value;
    const amount = Number(document.getElementById("debtor-amount").value);
    const paidAmount = Number(document.getElementById("debtor-paid").value || 0);
    const status = document.getElementById("debtor-status").value;
    const notes = document.getElementById("debtor-notes").value.trim();

    if (!name || !dueDate || amount <= 0) {
        alert("กรุณากรอกชื่อ วันที่กำหนดชำระ และยอดหนี้ให้ถูกต้อง");
        return;
    }

    if (paidAmount < 0 || paidAmount > amount) {
        alert("ยอดชำระแล้วต้องไม่ติดลบ และต้องไม่มากกว่ายอดหนี้");
        return;
    }

    const debtor = {
        id: editingId || "D" + Date.now(),
        name,
        phone,
        amount,
        paidAmount,
        outstanding: amount - paidAmount,
        dueDate,
        status,
        notes,
        updatedAt: new Date().toISOString()
    };

    const index = debtors.findIndex(d => d.id === debtor.id);

    if (index >= 0) {
        debtors[index] = debtor;
    } else {
        debtors.push(debtor);
    }

    localStorage.setItem("debtors", JSON.stringify(debtors));

    await sendToGoogleSheet(debtor);

    renderDebtors();
    updateDashboard();
    resetForm();

    alert("บันทึกข้อมูลเรียบร้อยแล้ว");
}

async function sendToGoogleSheet(data) {
    if (!WEB_APP_URL || WEB_APP_URL.includes("วางลิงก์")) return;

    try {
        await fetch(WEB_APP_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error("ส่งข้อมูลไป Google Sheets ไม่สำเร็จ", error);
    }
}

function renderDebtors() {
    const tbody = document.getElementById("debtors-list-body");
    const emptyState = document.getElementById("empty-state");
    const search = document.getElementById("search-input").value.toLowerCase();

    tbody.innerHTML = "";

    let filtered = debtors.filter(d => {
        const matchSearch =
            (d.name || "").toLowerCase().includes(search) ||
            (d.phone || "").toLowerCase().includes(search);

        const matchFilter =
            currentFilter === "all" || d.status === currentFilter;

        return matchSearch && matchFilter;
    });

    if (filtered.length === 0) {
        emptyState.style.display = "block";
        return;
    }

    emptyState.style.display = "none";

    filtered.forEach(d => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${d.name || "-"}</td>
            <td>${formatMoney(d.amount)}</td>
            <td>${formatMoney(d.paidAmount)}</td>
            <td>${formatMoney(d.outstanding)}</td>
            <td>${formatDate(d.dueDate)}</td>
            <td>${statusBadge(d.status)}</td>
            <td>
                <button class="btn btn-secondary" onclick="editDebtor('${d.id}')">
                    แก้ไข
                </button>
                <button class="btn btn-secondary" onclick="deleteDebtor('${d.id}')">
                    ลบ
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function updateDashboard() {
    const totalDebt = debtors.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const totalPaid = debtors.reduce((sum, d) => sum + Number(d.paidAmount || 0), 0);
    const totalOutstanding = debtors.reduce((sum, d) => sum + Number(d.outstanding || 0), 0);

    const paidPercent = totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0;
    const outstandingPercent = totalDebt > 0 ? (totalOutstanding / totalDebt) * 100 : 0;

    document.getElementById("stat-total-debt").textContent = formatMoney(totalDebt);
    document.getElementById("stat-total-paid").textContent = formatMoney(totalPaid);
    document.getElementById("stat-total-outstanding").textContent = formatMoney(totalOutstanding);

    document.getElementById("stat-total-count").textContent = `ลูกหนี้ทั้งหมด ${debtors.length} ราย`;
    document.getElementById("stat-paid-percentage").textContent = `คิดเป็น ${paidPercent.toFixed(0)}% ของทั้งหมด`;
    document.getElementById("stat-outstanding-percentage").textContent = `คงเหลือค้างชำระ ${outstandingPercent.toFixed(0)}%`;

    document.getElementById("stat-paid-progress").style.width = `${paidPercent}%`;
    document.getElementById("stat-outstanding-progress").style.width = `${outstandingPercent}%`;
}

function editDebtor(id) {
    const d = debtors.find(item => item.id === id);
    if (!d) return;

    editingId = id;

    document.getElementById("debtor-id").value = d.id;
    document.getElementById("debtor-name").value = d.name || "";
    document.getElementById("debtor-phone").value = d.phone || "";
    document.getElementById("debtor-due-date").value = d.dueDate || "";
    document.getElementById("debtor-amount").value = d.amount || "";
    document.getElementById("debtor-paid").value = d.paidAmount || 0;
    document.getElementById("debtor-notes").value = d.notes || "";
    document.getElementById("debtor-status").value = d.status || "pending";

    document.querySelectorAll(".status-select-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.status === d.status);
    });

    document.getElementById("submit-btn-text").textContent = "อัปเดตข้อมูล";
}

async function deleteDebtor(id) {
    if (!confirm("ต้องการลบข้อมูลนี้หรือไม่?")) return;

    debtors = debtors.filter(d => d.id !== id);
    localStorage.setItem("debtors", JSON.stringify(debtors));

    if (WEB_APP_URL && !WEB_APP_URL.includes("วางลิงก์")) {
        try {
            await fetch(WEB_APP_URL, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: "delete",
                    id
                })
            });
        } catch (error) {
            console.error(error);
        }
    }

    renderDebtors();
    updateDashboard();
}

function resetForm() {
    editingId = null;

    document.getElementById("debtor-form").reset();
    document.getElementById("debtor-paid").value = 0;
    document.getElementById("debtor-status").value = "pending";
    document.getElementById("submit-btn-text").textContent = "บันทึกข้อมูล";

    document.querySelectorAll(".status-select-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    document.querySelector('[data-status="pending"]').classList.add("active");
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " ฿";
}

function formatDate(date) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function statusBadge(status) {
    if (status === "paid") return "ชำระแล้ว";
    if (status === "partial") return "ค้างชำระบางส่วน";
    return "ค้างชำระ";
}