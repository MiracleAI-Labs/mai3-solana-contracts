use secp256k1::rand::rngs::OsRng;
use secp256k1::{Message, Secp256k1};
use solana_sdk::keccak::hashv as keccak;
use solana_sdk::secp256k1_recover::secp256k1_recover;

pub fn new_secp256k1_keypair() {
    let secp = Secp256k1::new();
    let (secret_key, public_key) = secp.generate_keypair(&mut OsRng);
    println!("private key {:?}", hex::encode(secret_key.as_ref()));
    println!(
        "address {:?}",
        hex::encode(keccak(&[&public_key.serialize_uncompressed()[1..]]).as_ref())
    );
}

pub fn recover_should_work(
    name: String, 
    photo: String, 
    twitter_id: String, 
    discord_id: String, 
    telegram_id: String,
    score: u64
    ) {
    let secp = Secp256k1::new();
    let (secret_key, public_key) = secp.generate_keypair(&mut OsRng);

    // let msg1 = name.to_string();
    // let msg2 = photo.to_string();
    // let msg3 = twitterID.to_string();
    // let msg4 = discordID.to_string();
    // let msg5 = telegramID.to_string();
    // let msg6 = score.to_string();

    let msg_hash = keccak(&[
        name.as_ref(), photo.as_ref(), twitter_id.as_ref(),
        discord_id.as_ref(), telegram_id.as_ref(), score.to_le_bytes().as_ref()
    ]);

    // let msg_hash = keccak(&[msg1.as_ref(), msg2.as_ref(), msg3.as_ref(), msg4.as_ref(), msg5.as_ref(), msg6.as_ref()]);
    let message = Message::from_slice(&msg_hash.as_ref()).unwrap();

    let signature = secp.sign_ecdsa_recoverable(&message, &secret_key);
    let (recovery_id, serialize_sig) = signature.serialize_compact();

    // println!("msg1: {}", msg1);
    // println!("msg2: {}", msg2);
    // println!("msg3: {}", msg3);
    // println!("msg4: {}", msg4);
    // println!("msg5: {}", msg5);
    // println!("msg6: {}", msg6);

    println!("msg_hash: {}", hex::encode(msg_hash.as_ref()));
    println!("recovery_id: {}", recovery_id.to_i32());
    println!("serialize_sig: {}", hex::encode(serialize_sig));
    println!("private key {}", hex::encode(secret_key.as_ref()));
    println!(
        "address {}",
        hex::encode(keccak(&[&public_key.serialize_uncompressed()[1..]]).as_ref())
    );

    let res = secp256k1_recover(
        msg_hash.as_ref(),
        recovery_id.to_i32() as u8,
        serialize_sig.as_ref(),
    )
    .unwrap();
    assert_eq!(
        keccak(&[&public_key.serialize_uncompressed()[1..]]).as_ref(),
        keccak(&[res.0.as_ref()]).as_ref()
    );

    println!("public_key: {}", hex::encode(keccak(&[&public_key.serialize_uncompressed()[1..]]).as_ref()));
    println!("recovered_key: {}", hex::encode(keccak(&[res.0.as_ref()]).as_ref()));
}

#[cfg(test)]
mod tests {
    use super::*;

    // #[test]
    // fn test_new_secp256k1_keypair() {
    //     new_secp256k1_keypair();
    // }

    // sudo cargo test -- --nocapture
    #[test]
    fn test_recover_should_work() {
        recover_should_work(
            "Jesse".to_string(),
            "https://w7.pngwing.com/pngs/153/594/png-transparent-solana-coin-sign-icon-shiny-golden-symmetric-geometrical-design.png".to_string(),
            "https://twitter.com/solana".to_string(),
            "https://discord.com/solana".to_string(),
            "https://t.me/solana".to_string(),
            20,
        );
    }
}
