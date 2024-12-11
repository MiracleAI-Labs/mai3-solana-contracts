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
    
    let msg_hash = keccak(&[
        name.as_ref(), photo.as_ref(), twitter_id.as_ref(),
        discord_id.as_ref(), telegram_id.as_ref(), score.to_le_bytes().as_ref()
    ]);

    let message = Message::from_slice(&msg_hash.as_ref()).unwrap();

    let signature = secp.sign_ecdsa_recoverable(&message, &secret_key);
    let (recovery_id, serialize_sig) = signature.serialize_compact();

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

/***
 msg_hash: 84cd14a5fbfc60234b90eefba1919ff0e1638f387dbf176f84fdf61b7a9a9aa3
recovery_id: 0
serialize_sig: b27ab82e590dc7fd0d760e3f8baad52595ba5a0b40c302b238487f1fe8c3bf3e5823cdd3097ccde308ec7435c5b987410e0682a8402285b3b10b584e6bf1fa50
private key f1efbf99b8797f1bec2601b1f310e5f928a7c4141142766db50b0ead72661a5e
address 14417921a9273e30f056604d56b407155487643ab35f48e447815fb64100f77f
public_key: 14417921a9273e30f056604d56b407155487643ab35f48e447815fb64100f77f
recovered_key: 14417921a9273e30f056604d56b407155487643ab35f48e447815fb64100f77f
***/
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
