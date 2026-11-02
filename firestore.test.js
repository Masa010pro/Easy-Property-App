const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_123";
const BOB_UID = "bob_456";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated user cannot read protected users collection", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection("users").get());
});

test("Authenticated user can read public advertised property", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("properties").doc("prop_public").set({
      name: "Sunrise Apartments",
      ownerId: ALICE_UID,
      isPublicAd: true,
    });
  });

  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(unauthDb.collection("properties").doc("prop_public").get());
});

test("Authenticated user can create their own profile", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).set({
      userId: ALICE_UID,
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      role: "OWNER",
    })
  );
});

test("User cannot create another user's profile", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertFails(
    aliceDb.collection("users").doc(BOB_UID).set({
      userId: BOB_UID,
      email: "bob@example.com",
      firstName: "Bob",
      lastName: "Jones",
      role: "TENANT",
    })
  );
});

test("Owner can create property", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertSucceeds(
    aliceDb.collection("properties").doc("prop_1").set({
      propertyId: "prop_1",
      ownerId: ALICE_UID,
      name: "Green Valley Estate",
      address: "123 Main Road",
      isPublicAd: false,
    })
  );
});
