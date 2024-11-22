import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { AnchorStudent } from "../target/types/anchor_student";

const NAME_SEED: string = "student_info";

describe("anchor-student", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorStudent as Program<AnchorStudent>;
  console.log("wallet address: ", provider.wallet.publicKey);

  const studentInfo = {
    name: "Just a test movie",
    age: 20,
    description: "我是测试学生",
  };
 
  const [studentInfoPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(NAME_SEED), Buffer.from(studentInfo.name), provider.wallet.publicKey.toBuffer()],
    program.programId,
  );

  it("Add a student info", async () => {
    // Add your test here.
    const tx = await program.methods.addStudentInfo(studentInfo.name, studentInfo.age, studentInfo.description).rpc();
    console.log("Your transaction signature", tx);

    const account = await program.account.studentInfo.fetch(studentInfoPda);
    console.log("Added account: ", account);
    expect(studentInfo.name === account.name);
    expect(studentInfo.age === account.age);
    expect(studentInfo.description === account.description);
    expect(account.owner === provider.wallet.publicKey);
  });

  it("Update a student info", async () => {
    const tx = await program.methods.updateStudentInfo(studentInfo.name, 18, studentInfo.description).rpc();
    console.log("Your transaction signature", tx);

    const account = await program.account.studentInfo.fetch(studentInfoPda);
    console.log("Updated account: ", account);
    expect(studentInfo.name === account.name);
    expect(18 === account.age);
    expect(studentInfo.description === account.description);
    expect(account.owner === provider.wallet.publicKey);
  });
});
