// ==========================================
// FINTRACK - PERSONAL FINANCE MANAGER
// ==========================================

// DOM ELEMENTS
const $ = (selector) => document.querySelector(selector);

const transactionForm = $("#transactionForm");
const transactionModal = $("#transactionModal");
const budgetForm = $("#budgetForm");

let transactions = JSON.parse(
  localStorage.getItem("fintrack_transactions") || "[]"
);

let budgets = JSON.parse(
  localStorage.getItem("fintrack_budgets") || "{}"
);

let editingId = null;
let incomeChart = null;
let categoryChart = null;

// ==========================================
// STORAGE
// ==========================================

function saveData() {
  localStorage.setItem(
    "fintrack_transactions",
    JSON.stringify(transactions)
  );

  localStorage.setItem(
    "fintrack_budgets",
    JSON.stringify(budgets)
  );
}

// ==========================================
// HELPERS
// ==========================================

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function todayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset)
    .toISOString().split("T")[0];
}

function formatDate(date) {
  return new Date(date + "T00:00:00").toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}

function isCurrentMonth(date) {
  const current = new Date();
  const transactionDate = new Date(date + "T00:00:00");

  return (
    transactionDate.getMonth() === current.getMonth() &&
    transactionDate.getFullYear() === current.getFullYear()
  );
}

function getCurrentMonthTransactions() {
  return transactions.filter(item => isCurrentMonth(item.date));
}

// ==========================================
// NAVIGATION
// ==========================================

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle(
      "active",
      link.dataset.page === pageId
    );
  });

  const page = document.getElementById(pageId);

  if (!page) return;

  page.classList.add("active");

  const titles = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    budget: "Budgets"
  };

  $("#pageTitle").textContent = titles[pageId];

  $("#sidebar").classList.remove("open");

  if (pageId === "dashboard") {
    updateDashboard();
  }

  if (pageId === "transactions") {
    renderTransactions();
  }

  if (pageId === "budget") {
    renderBudgets();
  }
}

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    showPage(link.dataset.page);
  });
});

document.querySelectorAll("[data-goto]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.goto);
  });
});

$("#menuToggle").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

// ==========================================
// TRANSACTION MODAL
// ==========================================

function openModal(id = null) {
  transactionForm.reset();
  editingId = id;

  $("#date").value = todayString();

  if (id !== null) {
    const transaction = transactions.find(
      item => item.id === id
    );

    if (!transaction) return;

    $("#modalTitle").textContent = "Edit Transaction";
    $("#description").value = transaction.description;
    $("#amount").value = transaction.amount;
    $("#transactionType").value = transaction.type;
    $("#category").value = transaction.category;
    $("#date").value = transaction.date;
    $("#saveTransaction").textContent = "Update Transaction";
  } else {
    $("#modalTitle").textContent = "Add Transaction";
    $("#saveTransaction").textContent = "Save Transaction";
  }

  transactionModal.classList.add("show");
  $("#description").focus();
}

function closeModal() {
  transactionModal.classList.remove("show");
  editingId = null;
}

$("#addTransactionBtn").addEventListener("click", () => {
  openModal();
});

$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);

transactionModal.addEventListener("click", event => {
  if (event.target === transactionModal) {
    closeModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal();
  }
});

// ==========================================
// ADD AND EDIT TRANSACTIONS
// ==========================================

transactionForm.addEventListener("submit", event => {
  event.preventDefault();

  const description = $("#description").value.trim();
  const amount = Number($("#amount").value);
  const type = $("#transactionType").value;
  const category = $("#category").value;
  const date = $("#date").value;

  if (
    !description ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !date
  ) {
    alert("Please enter valid transaction details.");
    return;
  }

  const transactionData = {
    description,
    amount,
    type,
    category,
    date
  };

  if (editingId !== null) {
    transactions = transactions.map(item =>
      item.id === editingId
        ? { ...item, ...transactionData }
        : item
    );
  } else {
    transactions.unshift({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      ...transactionData
    });
  }

  saveData();
  closeModal();
  refreshApp();

  alert(
    editingId === null
      ? "Transaction added successfully!"
      : "Transaction updated successfully!"
  );
});

// ==========================================
// DELETE TRANSACTION
// ==========================================

function deleteTransaction(id) {
  const confirmed = confirm(
    "Are you sure you want to delete this transaction?"
  );

  if (!confirmed) return;

  transactions = transactions.filter(
    item => item.id !== id
  );

  saveData();
  refreshApp();
}

// ==========================================
// TRANSACTION TABLE
// ==========================================

function transactionRow(item, showActions = false) {
  const sign = item.type === "income" ? "+" : "-";
  const amountClass = item.type === "income"
    ? "amount-income"
    : "amount-expense";

  return `
    <tr>
      <td>${escapeHTML(item.description)}</td>
      <td>${escapeHTML(item.category)}</td>
      <td>${formatDate(item.date)}</td>
      <td>
        <span class="type-badge ${item.type}">
          ${item.type === "income" ? "Income" : "Expense"}
        </span>
      </td>
      <td class="${amountClass}">
        ${sign}${formatCurrency(item.amount)}
      </td>
      ${
        showActions
          ? `<td>
              <button class="action-btn edit-btn"
                data-action="edit"
                data-id="${escapeHTML(item.id)}">Edit</button>
              <button class="action-btn delete-btn"
                data-action="delete"
                data-id="${escapeHTML(item.id)}">Delete</button>
            </td>`
          : ""
      }
    </tr>
  `;
}

function renderTransactions() {
  const search = $("#searchInput").value.toLowerCase();
  const type = $("#typeFilter").value;
  const category = $("#categoryFilter").value;

  const filtered = transactions.filter(item => {
    const matchesSearch =
      item.description.toLowerCase().includes(search) ||
      item.category.toLowerCase().includes(search);

    const matchesType =
      type === "all" || item.type === type;

    const matchesCategory =
      category === "all" || item.category === category;

    return matchesSearch && matchesType && matchesCategory;
  });

  const tbody = $("#transactionList");

  tbody.innerHTML = filtered.length
    ? filtered.map(item => transactionRow(item, true)).join("")
    : `<tr><td colspan="6" class="empty-state">
        No transactions found.
       </td></tr>`;
}

$("#searchInput").addEventListener("input", renderTransactions);
$("#typeFilter").addEventListener("change", renderTransactions);
$("#categoryFilter").addEventListener("change", renderTransactions);

$("#transactionList").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === "edit") {
    openModal(id);
  }

  if (button.dataset.action === "delete") {
    deleteTransaction(id);
  }
});

// ==========================================
// DASHBOARD CALCULATIONS
// ==========================================

function updateDashboard() {
  const currentTransactions = getCurrentMonthTransactions();

  const income = transactions
    .filter(item => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expense = transactions
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const monthlyIncome = currentTransactions
    .filter(item => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const monthlyExpense = currentTransactions
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  $("#totalBalance").textContent =
    formatCurrency(income - expense);

  $("#totalIncome").textContent =
    formatCurrency(income);

  $("#totalExpense").textContent =
    formatCurrency(expense);

  $("#totalSavings").textContent =
    formatCurrency(monthlyIncome - monthlyExpense);

  renderRecentTransactions();
  renderCharts();
}

// ==========================================
// RECENT TRANSACTIONS
// ==========================================

function renderRecentTransactions() {
  const recent = [...transactions]
    .sort((a, b) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    )
    .slice(0, 5);

  $("#recentTransactions").innerHTML = recent.length
    ? recent.map(item => transactionRow(item)).join("")
    : `<tr><td colspan="5" class="empty-state">
        No transactions yet. Add your first transaction!
       </td></tr>`;
}

// ==========================================
// CHARTS
// ==========================================

function renderCharts() {
  if (typeof Chart === "undefined") return;

  const now = new Date();

  const months = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      label: date.toLocaleDateString("en-IN", {
        month: "short"
      })
    });
  }

  const incomeData = months.map(month =>
    transactions
      .filter(item => {
        const date = new Date(item.date + "T00:00:00");

        return (
          item.type === "income" &&
          date.getMonth() === month.month &&
          date.getFullYear() === month.year
        );
      })
      .reduce((sum, item) => sum + item.amount, 0)
  );

  const expenseData = months.map(month =>
    transactions
      .filter(item => {
        const date = new Date(item.date + "T00:00:00");

        return (
          item.type === "expense" &&
          date.getMonth() === month.month &&
          date.getFullYear() === month.year
        );
      })
      .reduce((sum, item) => sum + item.amount, 0)
  );

  if (incomeChart) incomeChart.destroy();

  incomeChart = new Chart($("#incomeExpenseChart"), {
    type: "bar",
    data: {
      labels: months.map(item => item.label),
      datasets: [
        {
          label: "Income",
          data: incomeData,
          backgroundColor: "#16a36a",
          borderRadius: 5
        },
        {
          label: "Expenses",
          data: expenseData,
          backgroundColor: "#e45464",
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

  const categories = {};

  getCurrentMonthTransactions()
    .filter(item => item.type === "expense")
    .forEach(item => {
      categories[item.category] =
        (categories[item.category] || 0) + item.amount;
    });

  if (categoryChart) categoryChart.destroy();

  const categoryLabels = Object.keys(categories);

  categoryChart = new Chart($("#categoryChart"), {
    type: "doughnut",
    data: {
      labels: categoryLabels.length
        ? categoryLabels
        : ["No expenses"],
      datasets: [{
        data: categoryLabels.length
          ? Object.values(categories)
          : [1],
        backgroundColor: categoryLabels.length
          ? [
              "#635bdb",
              "#16a36a",
              "#f3a64a",
              "#e45464",
              "#4e9bd7",
              "#9b72cf",
              "#e18dba",
              "#8b98a9"
            ]
          : ["#d9dce5"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

// ==========================================
// BUDGET MANAGEMENT
// ==========================================

budgetForm.addEventListener("submit", event => {
  event.preventDefault();

  const category = $("#budgetCategory").value;
  const amount = Number($("#budgetAmount").value);

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Enter a valid budget amount.");
    return;
  }

  budgets[category] = amount;

  saveData();
  budgetForm.reset();
  renderBudgets();

  alert("Budget saved successfully!");
});

function renderBudgets() {
  const budgetList = $("#budgetList");

  const entries = Object.entries(budgets);

  if (!entries.length) {
    budgetList.innerHTML = `
      <div class="panel empty-state">
        No budgets created yet. Set your first monthly budget!
      </div>`;
    return;
  }

  budgetList.innerHTML = entries.map(([category, limit]) => {
    const spent = getCurrentMonthTransactions()
      .filter(item =>
        item.type === "expense" &&
        item.category === category
      )
      .reduce((sum, item) => sum + item.amount, 0);

    const percentage = (spent / limit) * 100;
    const width = Math.min(percentage, 100);
    const isOverBudget = spent > limit;

    return `
      <article class="budget-card">
        <h3>${escapeHTML(category)}</h3>

        <div class="budget-numbers">
          <span>Spent: ${formatCurrency(spent)}</span>
          <span>Limit: ${formatCurrency(limit)}</span>
        </div>

        <div class="progress-track">
          <div class="progress-fill ${isOverBudget ? "over-budget" : ""}"
            style="width:${width}%">
          </div>
        </div>

        <div class="budget-numbers" style="margin-top:12px">
          <span>${Math.round(percentage)}% used</span>
          <span>${isOverBudget ? "Over budget" : formatCurrency(limit - spent) + " remaining"}</span>
        </div>

        <button class="action-btn delete-btn"
          data-remove-budget="${escapeHTML(category)}">
          Remove Budget
        </button>
      </article>
    `;
  }).join("");
}

$("#budgetList").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-budget]");

  if (!button) return;

  const category = button.dataset.removeBudget;

  if (!confirm(`Remove ${category} budget?`)) return;

  delete budgets[category];

  saveData();
  renderBudgets();
});

// ==========================================
// CSV EXPORT
// ==========================================

function exportCSV() {
  if (!transactions.length) {
    alert("No transactions available to export.");
    return;
  }

  const headers = [
    "Description",
    "Amount",
    "Type",
    "Category",
    "Date"
  ];

  const rows = transactions.map(item => [
    item.description,
    item.amount,
    item.type,
    item.category,
    item.date
  ]);

  const csvValue = value =>
    `"${String(value).replace(/"/g, '""')}"`;

  const csv = [
    headers,
    ...rows
  ].map(row =>
    row.map(csvValue).join(",")
  ).join("\r\n");

  const blob = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "fintrack-transactions.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

$("#exportBtn").addEventListener("click", exportCSV);

// ==========================================
// DARK / LIGHT THEME
// ==========================================

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");

  $("#themeToggle").textContent =
    theme === "dark"
      ? "☀ Switch to Light"
      : "☾ Switch to Dark";

  localStorage.setItem("fintrack_theme", theme);
}

$("#themeToggle").addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark")
    ? "light"
    : "dark";

  applyTheme(nextTheme);
});

// ==========================================
// REFRESH APPLICATION
// ==========================================

function refreshApp() {
  updateDashboard();
  renderTransactions();
  renderBudgets();
}

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

function initializeApp() {
  $("#todayDate").textContent =
    new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  $("#date").value = todayString();

  const savedTheme = localStorage.getItem("fintrack_theme") || "light";
  applyTheme(savedTheme);

  refreshApp();
}

initializeApp();