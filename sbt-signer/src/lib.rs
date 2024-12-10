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
    twitterID: String, 
    discordID: String, 
    telegramID: String) {
    let secp = Secp256k1::new();
    let (secret_key, public_key) = secp.generate_keypair(&mut OsRng);

    let msg1 = name.to_string();
    let msg2 = photo.to_string();
    let msg3 = twitterID.to_string();
    let msg4 = discordID.to_string();
    let msg5 = telegramID.to_string();

    let msg_hash = keccak(&[msg1.as_ref(), msg2.as_ref(), msg3.as_ref(), msg4.as_ref(), msg5.as_ref()]);
    let message = Message::from_slice(&msg_hash.as_ref()).unwrap();

    let signature = secp.sign_ecdsa_recoverable(&message, &secret_key);
    let (recovery_id, serialize_sig) = signature.serialize_compact();

    println!("msg1: {}", msg1);
    println!("msg2: {}", msg2);
    println!("msg3: {}", msg3);
    println!("msg4: {}", msg4);
    println!("msg5: {}", msg5);
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
}

#[cfg(test)]
mod tests {
    use super::*;

    // #[test]
    // fn test_new_secp256k1_keypair() {
    //     new_secp256k1_keypair();
    // }

    #[test]
    fn test_recover_should_work() {
        recover_should_work(
            "John Doe".to_string(), 
            "https://example.com/photo.jpg".to_string(),
            "johndoe1".to_string(), 
            "johndoe2".to_string(), 
            "johndoe3".to_string()
        );
    }
}
