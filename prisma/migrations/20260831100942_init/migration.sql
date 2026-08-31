-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "image" TEXT
);

-- CreateTable
CREATE TABLE "Key" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "orderId" TEXT,
    "issuedAt" DATETIME,
    CONSTRAINT "Key_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("orderId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Key_sku_fkey" FOREIGN KEY ("sku") REFERENCES "Product" ("sku") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "keyId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("orderId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Key_code_key" ON "Key"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Key_orderId_key" ON "Key"("orderId");

-- CreateIndex
CREATE INDEX "Key_sku_status_idx" ON "Key"("sku", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderId_key" ON "Order"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_eventId_key" ON "Payment"("eventId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
