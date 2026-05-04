import {
  bigint,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role_enum", ["user", "admin"]);
export const trueFalseEnum = pgEnum("true_false_enum", ["true", "false"]);
export const serviceCategoryEnum = pgEnum("service_category_enum", ["Braids", "Twists", "Locs", "Kids Styles", "Add-ons"]);
export const bookingStatusEnum = pgEnum("booking_status_enum", ["pending", "confirmed", "completed", "cancelled"]);
export const depositStatusEnum = pgEnum("deposit_status_enum", ["unpaid", "checkout_started", "paid", "failed", "refunded"]);
export const productCategoryEnum = pgEnum("product_category_enum", ["Accessories", "Aftercare", "Hair Attachments"]);
export const stockStatusEnum = pgEnum("stock_status_enum", ["in_stock", "low_stock", "out_of_stock"]);
export const orderStatusEnum = pgEnum("order_status_enum", ["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"]);
export const galleryCategoryEnum = pgEnum("gallery_category_enum", ["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"]);
export const reviewStatusEnum = pgEnum("review_status_enum", ["pending", "approved", "rejected"]);
export const tryOnStatusEnum = pgEnum("try_on_status_enum", ["pending", "completed", "failed"]);

/**
 * Core user table backing auth flow.
 * Extended with Stripe customer reference for future paid customer journeys.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
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

export const websiteSections = pgTable("websiteSections", {
  id: serial("id").primaryKey(),
  sectionKey: varchar("sectionKey", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  eyebrow: varchar("eyebrow", { length: 160 }),
  body: text("body"),
  ctaLabel: varchar("ctaLabel", { length: 120 }),
  ctaHref: varchar("ctaHref", { length: 500 }),
  imageUrl: varchar("imageUrl", { length: 800 }),
  portraitImageUrl: varchar("portraitImageUrl", { length: 800 }),
  portraitDescription: text("portraitDescription"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  isPublished: trueFalseEnum("isPublished").default("true").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  category: serviceCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  duration: varchar("duration", { length: 80 }).notNull(),
  priceFrom: numeric("priceFrom", { precision: 10, scale: 2 }).notNull(),
  badge: varchar("badge", { length: 80 }),
  imageUrl: varchar("imageUrl", { length: 800 }),
  isBookable: trueFalseEnum("isBookable").default("true").notNull(),
  isFeatured: trueFalseEnum("isFeatured").default("false").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  serviceId: integer("serviceId"),
  serviceName: varchar("serviceName", { length: 180 }).notNull(),
  clientName: varchar("clientName", { length: 180 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }).notNull(),
  clientPhone: varchar("clientPhone", { length: 80 }).notNull(),
  addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  county: varchar("county", { length: 120 }),
  postcode: varchar("postcode", { length: 40 }).notNull(),
  deliveryNote: text("deliveryNote"),
  appointmentDate: varchar("appointmentDate", { length: 20 }).notNull(),
  appointmentTime: varchar("appointmentTime", { length: 20 }).notNull(),
  status: bookingStatusEnum("status").default("pending").notNull(),
  depositStatus: depositStatusEnum("depositStatus").default("unpaid").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  seoTitle: varchar("seoTitle", { length: 255 }),
  seoDescription: text("seoDescription"),
  category: productCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 800 }),
  badge: varchar("badge", { length: 80 }),
  stockStatus: stockStatusEnum("stockStatus").default("in_stock").notNull(),
  stockQuantity: integer("stockQuantity").default(0).notNull(),
  isFeatured: trueFalseEnum("isFeatured").default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const productVariants = pgTable("productVariants", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  colourHex: varchar("colourHex", { length: 20 }),
  stockQuantity: integer("stockQuantity").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 80 }),
  addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  county: varchar("county", { length: 120 }),
  postcode: varchar("postcode", { length: 40 }).notNull(),
  deliveryNote: text("deliveryNote"),
  status: orderStatusEnum("status").default("draft").notNull(),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const orderItems = pgTable("orderItems", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  productId: integer("productId").notNull(),
  variantId: integer("variantId"),
  productName: varchar("productName", { length: 180 }).notNull(),
  variantName: varchar("variantName", { length: 120 }),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: numeric("unitPrice", { precision: 10, scale: 2 }).notNull(),
});

export const galleryImages = pgTable("galleryImages", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  category: galleryCategoryEnum("category").notNull(),
  imageUrl: varchar("imageUrl", { length: 800 }).notNull(),
  altText: varchar("altText", { length: 255 }).notNull(),
  isPublished: trueFalseEnum("isPublished").default("true").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  rating: integer("rating").notNull(),
  reviewText: text("reviewText").notNull(),
  status: reviewStatusEnum("status").default("pending").notNull(),
  source: varchar("source", { length: 80 }).default("website").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const newsletterSubscribers = pgTable("newsletterSubscribers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  productAlerts: trueFalseEnum("productAlerts").default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const analyticsEvents = pgTable("analyticsEvents", {
  id: serial("id").primaryKey(),
  eventName: varchar("eventName", { length: 120 }).notNull(),
  pagePath: varchar("pagePath", { length: 500 }).notNull(),
  metadata: jsonb("metadata"),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tryOnGenerations = pgTable("tryOnGenerations", {
  id: serial("id").primaryKey(),
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
