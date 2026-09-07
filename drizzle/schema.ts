import {
  bigint,
  integer,
  json,
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
export const bookingStatusEnum = pgEnum("booking_status_enum", ["pending", "confirmed", "completed", "cancelled"]);
export const bookingLocationTypeEnum = pgEnum("booking_location_type_enum", ["studio", "home_service"]);
export const depositStatusEnum = pgEnum("deposit_status_enum", ["unpaid", "checkout_started", "paid", "failed", "refunded"]);
export const productCategoryEnum = pgEnum("product_category_enum", ["Accessories", "Aftercare", "Hair Attachments"]);
export const stockStatusEnum = pgEnum("stock_status_enum", ["in_stock", "low_stock", "out_of_stock"]);
export const orderStatusEnum = pgEnum("order_status_enum", ["draft", "pending_payment", "paid", "fulfilling", "shipped", "completed", "cancelled"]);
export const galleryCategoryEnum = pgEnum("gallery_category_enum", ["Braids", "Twists", "Locs", "Kids Styles", "Behind the Chair"]);
export const reviewStatusEnum = pgEnum("review_status_enum", ["pending", "approved", "rejected"]);
export const tryOnStatusEnum = pgEnum("try_on_status_enum", ["pending", "completed", "failed"]);
export const emailNotificationStatusEnum = pgEnum("email_notification_status_enum", ["pending", "sent", "failed", "retried"]);
export const emailNotificationAudienceEnum = pgEnum("email_notification_audience_enum", ["owner", "customer"]);
export const emailNotificationEntityEnum = pgEnum("email_notification_entity_enum", ["booking", "order"]);

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
  category: varchar("category", { length: 120 }).notNull(),
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
  serviceLocation: bookingLocationTypeEnum("serviceLocation").default("studio").notNull(),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 120 }),
  county: varchar("county", { length: 120 }),
  postcode: varchar("postcode", { length: 40 }),
  deliveryNote: text("deliveryNote"),
  homeServiceSurcharge: numeric("homeServiceSurcharge", { precision: 10, scale: 2 }).default("0.00").notNull(),
  checkoutSurchargeCharged: numeric("checkoutSurchargeCharged", { precision: 10, scale: 2 }).default("0.00").notNull(),
  checkoutTotalCharged: numeric("checkoutTotalCharged", { precision: 10, scale: 2 }),
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
  imageUrl: varchar("imageUrl", { length: 800 }),
  stockQuantity: integer("stockQuantity").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
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
  checkoutTotalCharged: numeric("checkoutTotalCharged", { precision: 10, scale: 2 }),
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
  imageUrl: varchar("imageUrl", { length: 800 }),
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

export const productReviews = pgTable("productReviews", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
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
  metadata: json("metadata"),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const activityLogs = pgTable("activityLogs", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  userName: varchar("userName", { length: 180 }),
  userEmail: varchar("userEmail", { length: 320 }),
  sessionId: varchar("sessionId", { length: 128 }),
  activityType: varchar("activityType", { length: 120 }).notNull(),
  activityCategory: varchar("activityCategory", { length: 120 }).notNull(),
  description: text("description").notNull(),
  pageUrl: varchar("pageUrl", { length: 800 }),
  metadata: json("metadata"),
  status: varchar("status", { length: 30 }).default("info").notNull(),
  ipAddress: varchar("ipAddress", { length: 80 }),
  country: varchar("country", { length: 120 }),
  city: varchar("city", { length: 120 }),
  region: varchar("region", { length: 120 }),
  deviceType: varchar("deviceType", { length: 40 }),
  browser: varchar("browser", { length: 80 }),
  userAgent: varchar("userAgent", { length: 500 }),
  relatedEntityType: varchar("relatedEntityType", { length: 80 }),
  relatedEntityId: varchar("relatedEntityId", { length: 120 }),
  sourceApp: varchar("sourceApp", { length: 80 }).default("ebysplace").notNull(),
  isRead: trueFalseEnum("isRead").default("false").notNull(),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const pushSubscriptions = pgTable("pushSubscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const smsSubscriptions = pgTable("smsSubscriptions", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Separate from pushSubscriptions (the public homepage opt-in) so owner
 * alerts — new bookings, orders, reviews, stock warnings — never get pushed
 * to a customer's browser by mistake.
 */
export const ownerPushSubscriptions = pgTable("ownerPushSubscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const emailNotificationLogs = pgTable("emailNotificationLogs", {
  id: serial("id").primaryKey(),
  entityType: emailNotificationEntityEnum("entityType").notNull(),
  entityId: integer("entityId").notNull(),
  audience: emailNotificationAudienceEnum("audience").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  bodyPreview: text("bodyPreview"),
  status: emailNotificationStatusEnum("status").default("pending").notNull(),
  provider: varchar("provider", { length: 80 }).default("zoho_smtp").notNull(),
  smtpHost: varchar("smtpHost", { length: 255 }),
  messageId: varchar("messageId", { length: 255 }),
  errorMessage: text("errorMessage"),
  attempts: integer("attempts").default(0).notNull(),
  lastAttemptAtMs: bigint("lastAttemptAtMs", { mode: "number" }),
  sentAtMs: bigint("sentAtMs", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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

export const tryOnAccounts = pgTable("tryOnAccounts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 80 }),
  freeTrialUsed: trueFalseEnum("freeTrialUsed").default("false").notNull(),
  creditsRemaining: integer("creditsRemaining").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Service = typeof services.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ProductReview = typeof productReviews.$inferSelect;
export type EmailNotificationLog = typeof emailNotificationLogs.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
