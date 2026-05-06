import {
  bigint,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const userRoleEnum = (name: string) => mysqlEnum(name, ["user", "admin"]);
export const trueFalseEnum = (name: string) => mysqlEnum(name, ["true", "false"]);
export const serviceCategoryEnum = (name: string) => mysqlEnum(name, ["Braids", "Twists", "Locs", "Kids Styles", "Men Styles", "Add-ons"]);
export const bookingStatusEnum = (name: string) => mysqlEnum(name, ["pending", "confirmed", "completed", "cancelled"]);
export const bookingLocationTypeEnum = (name: string) => mysqlEnum(name, ["studio", "home_service"]);
export const depositStatusEnum = (name: string) => mysqlEnum(name, ["unpaid", "checkout_started", "paid", "failed", "refunded"]);
export const productCategoryEnum = (name: string) => mysqlEnum(name, ["Accessories", "Aftercare", "Hair Attachments"]);
export const stockStatusEnum = (name: string) => mysqlEnum(name, ["in_stock", "low_stock", "out_of_stock"]);
export const orderStatusEnum = (name: string) => mysqlEnum(name, ["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"]);
export const galleryCategoryEnum = (name: string) => mysqlEnum(name, ["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"]);
export const reviewStatusEnum = (name: string) => mysqlEnum(name, ["pending", "approved", "rejected"]);
export const tryOnStatusEnum = (name: string) => mysqlEnum(name, ["pending", "completed", "failed"]);
export const emailNotificationStatusEnum = (name: string) => mysqlEnum(name, ["pending", "sent", "failed", "retried"]);
export const emailNotificationAudienceEnum = (name: string) => mysqlEnum(name, ["owner", "customer"]);
export const emailNotificationEntityEnum = (name: string) => mysqlEnum(name, ["booking", "order"]);

/**
 * Core user table backing auth flow.
 * Extended with Stripe customer reference for future paid customer journeys.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const websiteSections = mysqlTable("websiteSections", {
  id: int("id").autoincrement().primaryKey(),
  sectionKey: varchar("sectionKey", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  eyebrow: varchar("eyebrow", { length: 160 }),
  body: text("body"),
  ctaLabel: varchar("ctaLabel", { length: 120 }),
  ctaHref: varchar("ctaHref", { length: 500 }),
  imageUrl: varchar("imageUrl", { length: 800 }),
  portraitImageUrl: varchar("portraitImageUrl", { length: 800 }),
  portraitDescription: text("portraitDescription"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isPublished: trueFalseEnum("isPublished").default("true").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  category: serviceCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  duration: varchar("duration", { length: 80 }).notNull(),
  priceFrom: decimal("priceFrom", { precision: 10, scale: 2 }).notNull(),
  badge: varchar("badge", { length: 80 }),
  imageUrl: varchar("imageUrl", { length: 800 }),
  isBookable: trueFalseEnum("isBookable").default("true").notNull(),
  isFeatured: trueFalseEnum("isFeatured").default("false").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId"),
  serviceName: varchar("serviceName", { length: 180 }).notNull(),
  clientName: varchar("clientName", { length: 180 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }).notNull(),
  clientPhone: varchar("clientPhone", { length: 80 }).notNull(),
  serviceLocation: bookingLocationTypeEnum("serviceLocation").default("studio").notNull(),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 120 }),
  county: varchar("county", { length: 120 }),
  postcode: varchar("postcode", { length: 40 }),
  deliveryNote: text("deliveryNote"),
  homeServiceSurcharge: decimal("homeServiceSurcharge", { precision: 10, scale: 2 }).default("0.00").notNull(),
  appointmentDate: varchar("appointmentDate", { length: 20 }).notNull(),
  appointmentTime: varchar("appointmentTime", { length: 20 }).notNull(),
  status: bookingStatusEnum("status").default("pending").notNull(),
  depositStatus: depositStatusEnum("depositStatus").default("unpaid").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  seoTitle: varchar("seoTitle", { length: 255 }),
  seoDescription: text("seoDescription"),
  category: productCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 800 }),
  badge: varchar("badge", { length: 80 }),
  stockStatus: stockStatusEnum("stockStatus").default("in_stock").notNull(),
  stockQuantity: int("stockQuantity").default(0).notNull(),
  isFeatured: trueFalseEnum("isFeatured").default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const productVariants = mysqlTable("productVariants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  colourHex: varchar("colourHex", { length: 20 }),
  stockQuantity: int("stockQuantity").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 80 }),
  serviceLocation: bookingLocationTypeEnum("serviceLocation").default("studio").notNull(),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 120 }),
  county: varchar("county", { length: 120 }),
  postcode: varchar("postcode", { length: 40 }),
  deliveryNote: text("deliveryNote"),
  status: orderStatusEnum("status").default("draft").notNull(),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  variantId: int("variantId"),
  productName: varchar("productName", { length: 180 }).notNull(),
  variantName: varchar("variantName", { length: 120 }),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
});

export const galleryImages = mysqlTable("galleryImages", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  category: galleryCategoryEnum("category").notNull(),
  imageUrl: varchar("imageUrl", { length: 800 }).notNull(),
  altText: varchar("altText", { length: 255 }).notNull(),
  isPublished: trueFalseEnum("isPublished").default("true").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  rating: int("rating").notNull(),
  reviewText: text("reviewText").notNull(),
  status: reviewStatusEnum("status").default("pending").notNull(),
  source: varchar("source", { length: 80 }).default("website").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const newsletterSubscribers = mysqlTable("newsletterSubscribers", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  productAlerts: trueFalseEnum("productAlerts").default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const analyticsEvents = mysqlTable("analyticsEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventName: varchar("eventName", { length: 120 }).notNull(),
  pagePath: varchar("pagePath", { length: 500 }).notNull(),
  metadata: json("metadata"),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const emailNotificationLogs = mysqlTable("emailNotificationLogs", {
  id: int("id").autoincrement().primaryKey(),
  entityType: emailNotificationEntityEnum("entityType").notNull(),
  entityId: int("entityId").notNull(),
  audience: emailNotificationAudienceEnum("audience").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  bodyPreview: text("bodyPreview"),
  status: emailNotificationStatusEnum("status").default("pending").notNull(),
  provider: varchar("provider", { length: 80 }).default("zoho_smtp").notNull(),
  smtpHost: varchar("smtpHost", { length: 255 }),
  messageId: varchar("messageId", { length: 255 }),
  errorMessage: text("errorMessage"),
  attempts: int("attempts").default(0).notNull(),
  lastAttemptAtMs: bigint("lastAttemptAtMs", { mode: "number" }),
  sentAtMs: bigint("sentAtMs", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const tryOnGenerations = mysqlTable("tryOnGenerations", {
  id: int("id").autoincrement().primaryKey(),
  styleName: varchar("styleName", { length: 160 }).notNull(),
  originalImageUrl: varchar("originalImageUrl", { length: 800 }).notNull(),
  generatedImageUrl: varchar("generatedImageUrl", { length: 800 }),
  status: tryOnStatusEnum("status").default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Service = typeof services.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type EmailNotificationLog = typeof emailNotificationLogs.$inferSelect;
