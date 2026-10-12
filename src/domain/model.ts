import { z } from "zod";

export const Role = z.enum([
  "TECH_ADMIN",
  "HUB_ADMIN",
  "COOP_LEAD",
  "FIELD_STAFF",
  "MANUFACTURER",
  "DISTRIBUTOR",
]);
export type Role = z.infer<typeof Role>;

export const OrganizationType = z.enum(["COOPERATIVE", "MANUFACTURER", "DISTRIBUTOR"]);
export type OrganizationType = z.infer<typeof OrganizationType>;

export const HubStatus = z.enum(["PENDING_VERIFICATION", "VERIFIED", "REJECTED", "SUSPENDED"]);
export const InviteStatus = z.enum(["ACTIVE", "REVOKED", "EXPIRED", "EXHAUSTED"]);
export type InviteStatus = z.infer<typeof InviteStatus>;
export const CropStatus = z.enum(["ALREADY_GROWS", "CURRENTLY_GROWING", "WANTS_TO_GROW"]);
export const PayoutStatus = z.enum(["PENDING_APPROVAL", "APPROVED", "PROCESSING", "SUCCEEDED", "FAILED"]);
export const TransferStatus = z.enum(["SENT", "RECEIVED"]);
export type TransferStatus = z.infer<typeof TransferStatus>;
export const InvoiceStatus = z.enum(["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"]);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;
export const OrderStatus = z.enum(["PENDING", "DELIVERED", "CANCELLED"]);
export type OrderStatus = z.infer<typeof OrderStatus>;
export const OrderCategory = z.enum(["RETAIL", "WHOLESALE", "SAMPLE"]);
export type OrderCategory = z.infer<typeof OrderCategory>;
export const OrderChannel = z.enum(["PHONE", "WHATSAPP", "TEAM_MEMBER", "OFFICE_WALK_IN", "IN_PERSON", "POP_UP_SHOP", "INSTAGRAM", "FACEBOOK", "OTHER"]);
export type OrderChannel = z.infer<typeof OrderChannel>;
export const PaymentMethod = z.enum(["MOBILE_MONEY", "CASH", "BANK_TRANSFER"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;
export const TransferKind = z.enum(["RAW_MATERIAL", "FINISHED_GOODS"]);
export const ProductUnit = z.enum(["KG", "UNIT"]);
export type ProductUnit = z.infer<typeof ProductUnit>;
// Weights and quantities: decimal strings with up to 3 places, never floats.
export const Quantity = z.string().regex(/^\d+(\.\d{1,3})?$/);
export const MembershipStatus = z.enum(["ACTIVE", "REMOVED", "SUSPENDED"]);
export const HubVerificationDecision = z.enum(["VERIFIED", "REJECTED"]);
export const MasterCropStatus = z.enum(["ACTIVE", "ARCHIVED"]);

export const AuditFields = z.object({
  createdById: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AuditFields = z.infer<typeof AuditFields>;

// Records that are never deleted are voided instead, with who, when and why.
export const VoidFields = z.object({
  voidedAt: z.string().datetime().optional(),
  voidedById: z.string().min(1).optional(),
  voidReason: z.string().min(1).optional(),
});

export const Country = z.object({
  id: z.string().min(1),
  code: z.string().length(2),
  name: z.string().min(1),
  // The main currency; amounts are converted into it for combined totals.
  currency: z.string().length(3),
  // Every currency money can be recorded in, main currency first (Liberia: LRD and USD).
  currencies: z.array(z.string().length(3)).min(1),
  defaultLanguage: z.string().min(2),
  timeZone: z.string().min(1),
  dialCode: z.string().regex(/^\+\d{1,4}$/),
  phoneFormat: z.string().min(1),
  enabledMobileMoneyProviders: z.array(z.string()),
});
export type Country = z.infer<typeof Country>;

export const Hub = z.object({
  id: z.string().min(1),
  countryId: z.string().min(1),
  businessName: z.string().min(1),
  status: HubStatus,
  regionOrCounty: z.string().min(1),
  physicalAddress: z.string().min(1),
  gps: z.string().regex(/^-?\d+(\.\d+)?, -?\d+(\.\d+)?$/).optional(),
  businessCategory: z.string().min(1),
  yearEstablished: z.number().int().min(1800),
  businessRegistrationNumber: z.string().min(1),
  registrationCertificateUrl: z.string().min(1),
  taxId: z.string().optional(),
  contactPerson: z.object({
    fullName: z.string().min(1),
    title: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
  }),
  mainCropIds: z.array(z.string()),
  approximateFarmerCount: z.number().int().nonnegative(),
  approximateCooperativeCount: z.number().int().nonnegative(),
  logoUrl: z.string().optional(),
  websiteOrSocialPage: z.string().optional(),
}).extend(AuditFields.shape);
export type Hub = z.infer<typeof Hub>;

export const HubVerification = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  reviewedById: z.string().min(1),
  decision: HubVerificationDecision,
  reason: z.string().optional(),
  reviewedAt: z.string().datetime(),
}).extend(AuditFields.shape);
export type HubVerification = z.infer<typeof HubVerification>;

export const Crop = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: MasterCropStatus,
}).extend(AuditFields.shape);
export type Crop = z.infer<typeof Crop>;

export const HubCrop = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  cropId: z.string().min(1),
  enabled: z.boolean(),
  grades: z.array(z.object({
    gradeId: z.string().min(1),
    name: z.string().min(1),
    priceMinorPerKg: z.number().int().nonnegative(),
    currency: z.string().length(3),
  })),
}).extend(AuditFields.shape);
export type HubCrop = z.infer<typeof HubCrop>;

export const Organization = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  name: z.string().min(1),
  type: OrganizationType,
  suspendedAt: z.string().datetime().optional(),
  suspendedById: z.string().min(1).optional(),
}).extend(AuditFields.shape);
export type Organization = z.infer<typeof Organization>;

export const User = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1),
  username: z.string().min(3),
  // Required at signup (see auth/signup.ts); only system accounts such as the tech admin have none.
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  photoUrl: z.string().startsWith("data:image/").max(300_000).optional(),
  passwordHash: z.string().min(1),
  passwordSalt: z.string().min(1),
}).extend(AuditFields.shape);
export type User = z.infer<typeof User>;

export const Membership = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  hubId: z.string().min(1),
  organizationId: z.string().optional(),
  role: Role,
  status: MembershipStatus,
  removedAt: z.string().datetime().optional(),
  removedById: z.string().min(1).optional(),
}).extend(AuditFields.shape);
export type Membership = z.infer<typeof Membership>;

export const Invite = z.object({
  id: z.string().min(1),
  code: z.string().min(8),
  hubId: z.string().min(1),
  organizationId: z.string().optional(),
  // A new organization to create when the invite is first accepted.
  organizationName: z.string().trim().min(1).optional(),
  role: Role,
  invitedById: z.string().min(1),
  email: z.string().email().optional(),
  maxUses: z.number().int().positive(),
  uses: z.number().int().nonnegative(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
  revokedById: z.string().min(1).optional(),
}).extend(AuditFields.shape);
export type Invite = z.infer<typeof Invite>;

export const Delivery = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  cooperativeId: z.string().min(1),
  farmerId: z.string().min(1),
  plotId: z.string().optional(),
  cropId: z.string().min(1),
  kilograms: z.string().regex(/^\d+(\.\d{1,3})?$/),
  gradeId: z.string().min(1),
  priceMinorPerKg: z.number().int().nonnegative(),
  amountOwedMinor: z.number().int().nonnegative(),
  rejectionReason: z.string().optional(),
}).extend(VoidFields.shape).extend(AuditFields.shape);
export type Delivery = z.infer<typeof Delivery>;

export const Payout = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  farmerId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  method: PaymentMethod,
  status: PayoutStatus,
  idempotencyKey: z.string().min(1),
  providerReference: z.string().optional(),
}).extend(AuditFields.shape);
export type Payout = z.infer<typeof Payout>;

export const FarmerDetails = z.object({
  fullName: z.string().trim().min(1),
  gender: z.enum(["FEMALE", "MALE"]),
  dateOfBirth: z.string().date().optional(),
  age: z.number().int().min(0).max(120),
  community: z.string().trim().min(1),
  phone: z.string().trim().min(1).optional(),
  mobileMoneyNumber: z.string().trim().min(1).optional(),
  photoUrl: z.string().startsWith("data:image/").max(300_000).optional(),
  householdSize: z.number().int().nonnegative().optional(),
  dependents: z.number().int().nonnegative().optional(),
  headOfHousehold: z.boolean().optional(),
  topCrops: z.array(z.object({ crop: z.string().min(1), status: CropStatus })).min(1).max(3)
    .refine((crops) => new Set(crops.map((item) => item.crop)).size === crops.length, "A crop can only be ranked once"),
  plots: z.array(z.object({
    id: z.string().min(1).optional(),
    description: z.string().trim().min(1),
    village: z.string().trim().min(1),
    size: z.number().positive(),
    unit: z.enum(["ACRES", "HECTARES"]),
    tenure: z.enum(["OWNED", "RENTED", "SHARED"]),
    crops: z.array(z.string().min(1)),
    otherCrop: z.string().trim().min(1).optional(),
    gps: z.string().regex(/^-?\d+(\.\d+)?, -?\d+(\.\d+)?$/).optional(),
  }).refine((plot) => !plot.crops.includes("Other") || plot.otherCrop, "Name the other crop")).min(1),
  incomeSource: z.string().min(1),
});

export const Farmer = FarmerDetails.extend({
  id: z.string().min(1),
  hubId: z.string().min(1),
  cooperativeId: z.string().min(1),
  // Set when a farmer synced from a device looks like one already registered; the coop lead reviews it.
  possibleDuplicateOf: z.array(z.string().min(1)).optional(),
}).extend(AuditFields.shape);
export type Farmer = z.infer<typeof Farmer>;

// Only a SHA-256 hash of the session token is stored, never the token itself.
export const Session = z.object({
  id: z.string().min(1),
  tokenHash: z.string().min(1),
  userId: z.string().min(1),
  expiresAt: z.string().datetime(),
}).extend(AuditFields.shape);
export type Session = z.infer<typeof Session>;

// Someone who has filled in the signup form but not yet onboarded their hub. Kept in the
// database (not server memory) so the next step works on any server instance; expires in an hour.
export const PendingSignup = z.object({
  id: z.string().min(1),
  tokenHash: z.string().min(1),
  fullName: z.string().min(1),
  username: z.string().min(3),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  photoUrl: z.string().startsWith("data:image/").max(300_000).optional(),
  passwordHash: z.string().min(1),
  passwordSalt: z.string().min(1),
  expiresAt: z.string().datetime(),
}).extend(AuditFields.shape);

export const PasswordReset = z.object({
  id: z.string().min(1),
  tokenHash: z.string().min(1),
  userId: z.string().min(1),
  expiresAt: z.string().datetime(),
  usedAt: z.string().datetime().optional(),
}).extend(AuditFields.shape);
export type PasswordReset = z.infer<typeof PasswordReset>;

export const OutboxEmail = z.object({
  id: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1),
  text: z.string().min(1),
  link: z.string().optional(),
}).extend(AuditFields.shape);
export type OutboxEmail = z.infer<typeof OutboxEmail>;

// How many main-currency units one unit of another currency buys, from a moment on.
// Set by the tech admin per country. Never edited: a new rate is a new record, so past
// amounts always convert at the rate in force on their own date.
export const ExchangeRate = z.object({
  id: z.string().min(1),
  countryId: z.string().min(1),
  currency: z.string().length(3),
  // Main-currency units per 1 unit of `currency`, in ten-thousandths (190.5 -> 1_905_000).
  rateTenThousandths: z.number().int().positive(),
  effectiveFrom: z.string().datetime(),
}).extend(AuditFields.shape);
export type ExchangeRate = z.infer<typeof ExchangeRate>;

// Which currencies besides the main one a country accepts, set by the tech admin.
// One record per country (id = country id); without one, the country's defaults apply.
export const CurrencySetting = z.object({
  id: z.string().min(1),
  countryId: z.string().min(1),
  extraCurrencies: z.array(z.string().length(3)),
}).extend(AuditFields.shape);
export type CurrencySetting = z.infer<typeof CurrencySetting>;

export const Product = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string().trim().min(1),
  unit: ProductUnit,
}).extend(AuditFields.shape);
export type Product = z.infer<typeof Product>;

// Goods moving between two organizations. Links to deliveries (raw material) or
// to a batch (finished goods) are kept as ids so every sale traces back to farmers.
export const Transfer = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  kind: TransferKind,
  fromOrganizationId: z.string().min(1),
  toOrganizationId: z.string().min(1),
  cropId: z.string().min(1).optional(),
  deliveryIds: z.array(z.string().min(1)),
  productId: z.string().min(1).optional(),
  batchId: z.string().min(1).optional(),
  unit: ProductUnit,
  quantitySent: Quantity,
  quantityReceived: Quantity.optional(),
  status: TransferStatus,
  hasDiscrepancy: z.boolean(),
  note: z.string().trim().min(1).optional(),
  receivedAt: z.string().datetime().optional(),
  receivedById: z.string().min(1).optional(),
}).extend(VoidFields.shape).extend(AuditFields.shape);
export type Transfer = z.infer<typeof Transfer>;

export const Batch = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  organizationId: z.string().min(1),
  number: z.number().int().positive(),
  productId: z.string().min(1),
  transferIds: z.array(z.string().min(1)).min(1),
  inputKg: Quantity,
  quantityProduced: Quantity,
  wastageKg: Quantity,
  producedAt: z.string().datetime(),
}).extend(VoidFields.shape).extend(AuditFields.shape);
export type Batch = z.infer<typeof Batch>;

export const Customer = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  address: z.string().trim().min(1).optional(),
  paymentTermsDays: z.number().int().min(0).max(365),
  archivedAt: z.string().datetime().optional(),
}).extend(AuditFields.shape);
export type Customer = z.infer<typeof Customer>;

export const Sale = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  distributorId: z.string().min(1),
  customerId: z.string().min(1),
  productId: z.string().min(1),
  batchId: z.string().min(1),
  quantity: Quantity,
  unitPriceMinor: z.number().int().nonnegative(),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  soldAt: z.string().datetime(),
  invoiceId: z.string().min(1).optional(),
  // Set when the sale is a line of an order. The discount is taken off amountMinor.
  orderId: z.string().min(1).optional(),
  discountMinor: z.number().int().nonnegative().optional(),
}).extend(VoidFields.shape).extend(AuditFields.shape);
export type Sale = z.infer<typeof Sale>;

// A customer order from a distributor: one sale per SKU line, numbered per hub.
// Cancelling a pending order voids its sales, which returns their stock.
export const Order = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  distributorId: z.string().min(1),
  number: z.number().int().positive(),
  // The hub's own order number when it differs from ours, e.g. "JSK0001" for imported history.
  reference: z.string().trim().min(1).max(40).optional(),
  customerId: z.string().min(1),
  orderedOn: z.string().date(),
  category: OrderCategory,
  channel: OrderChannel,
  status: OrderStatus,
  discountBasisPoints: z.number().int().min(0).max(10_000),
  deliveredBy: z.string().trim().min(1).max(120).optional(),
  deliveredOn: z.string().date().optional(),
  cancelledAt: z.string().datetime().optional(),
  cancelledById: z.string().min(1).optional(),
  cancelReason: z.string().min(1).optional(),
  currency: z.string().length(3),
}).extend(AuditFields.shape);
export type Order = z.infer<typeof Order>;

export const Invoice = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  distributorId: z.string().min(1),
  number: z.number().int().positive(),
  customerId: z.string().min(1),
  saleIds: z.array(z.string().min(1)).min(1),
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  issuedAt: z.string().datetime(),
  dueDate: z.string().date(),
}).extend(VoidFields.shape).extend(AuditFields.shape);
export type Invoice = z.infer<typeof Invoice>;

export const Collection = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  invoiceId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  method: PaymentMethod,
  reference: z.string().trim().min(1).optional(),
  receivedAt: z.string().datetime(),
}).extend(VoidFields.shape).extend(AuditFields.shape);
export type Collection = z.infer<typeof Collection>;

const NamedAmount = z.object({ name: z.string(), amountMinor: z.number().int(), quantity: z.string().optional() });
export const MonthlyReportData = z.object({
  currency: z.string().length(3),
  financial: z.object({ salesMinor: z.number().int(), invoicedMinor: z.number().int(), collectedMinor: z.number().int(), paidToFarmersMinor: z.number().int() }),
  operations: z.object({ receivedKg: Quantity, producedKg: Quantity, producedUnits: Quantity, wastageKg: Quantity, averageYieldPercent: z.number().nullable(), discrepancies: z.number().int() }),
  farmers: z.object({ newRegistrations: z.number().int(), activeFarmers: z.number().int(), deliveries: z.number().int(), payouts: z.number().int() }),
  sales: z.object({ byCustomer: z.array(NamedAmount), byProduct: z.array(NamedAmount), overdueInvoices: z.number().int(), overdueMinor: z.number().int() }),
});
export type MonthlyReportData = z.infer<typeof MonthlyReportData>;

export const MonthlyReport = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  data: MonthlyReportData,
}).extend(AuditFields.shape);
export type MonthlyReport = z.infer<typeof MonthlyReport>;

export const AuditLog = z.object({
  id: z.string().min(1),
  hubId: z.string().min(1).optional(),
  action: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().min(1),
  reason: z.string().optional(),
  // A JSON copy of a record version, e.g. a farmer before an edit (versions are never lost).
  snapshot: z.string().max(400_000).optional(),
}).extend(AuditFields.shape);
export type AuditLog = z.infer<typeof AuditLog>;

export const PayoutDelivery = z.object({ payoutId: z.string().min(1), deliveryId: z.string().min(1) });
export const TransferDelivery = z.object({ transferId: z.string().min(1), deliveryId: z.string().min(1) });
export const BatchTransfer = z.object({ batchId: z.string().min(1), transferId: z.string().min(1) });
export const InvoiceSale = z.object({ invoiceId: z.string().min(1), saleId: z.string().min(1) });

export const EntitySchemas = { Country, Hub, HubVerification, Crop, HubCrop, Organization, User, Membership, Invite, Delivery, Payout, Farmer, Session, PendingSignup, PasswordReset, OutboxEmail, ExchangeRate, CurrencySetting, Product, Transfer, Batch, Customer, Order, Sale, Invoice, Collection, MonthlyReport, AuditLog } as const;
export type EntityName = keyof typeof EntitySchemas;
export type EntityOf<T extends EntityName> = z.infer<(typeof EntitySchemas)[T]>;
export type Entity = EntityOf<EntityName>;
