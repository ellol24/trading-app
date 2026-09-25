require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching all user profiles...");
  const { data: users, error } = await supabase.from("user_profiles").select("uid, email, referral_code_used, created_at");
  if (error) {
    console.error(error);
    return;
  }
  
  if (!users) return;
  console.log(`Found ${users.length} users. Checking for missing referral tree...`);
  
  for (const user of users) {
    if (!user.referral_code_used) continue;
    
    // Check if level 1 already exists
    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_id", user.uid)
      .eq("level", 1)
      .single();
      
    if (!existing) {
        console.log(`User ${user.email} used code ${user.referral_code_used} but has no referrals row! Bridging...`);
        // We know they used a referral code. Find level 1!
        const { data: level1 } = await supabase
          .from("user_profiles")
          .select("uid")
          .eq("referral_code", user.referral_code_used)
          .single();
          
        if (level1?.uid) {
           // Insert Level 1
           await supabase.from("referrals").insert({
             referrer_id: level1.uid,
             referred_id: user.uid,
             referred_email: user.email,
             status: "active",
             level: 1,
             created_at: user.created_at
           });
           
           // Insert Level 2
           const { data: level2Ref } = await supabase
              .from("referrals")
              .select("referrer_id")
              .eq("referred_id", level1.uid)
              .eq("level", 1)
              .single();
              
           if (level2Ref?.referrer_id) {
               await supabase.from("referrals").insert({
                 referrer_id: level2Ref.referrer_id,
                 referred_id: user.uid,
                 referred_email: user.email,
                 status: "active",
                 level: 2,
                 created_at: user.created_at
               });
               
               // Insert Level 3
               const { data: level3Ref } = await supabase
                  .from("referrals")
                  .select("referrer_id")
                  .eq("referred_id", level2Ref.referrer_id)
                  .eq("level", 1)
                  .single();
                  
               if (level3Ref?.referrer_id) {
                   await supabase.from("referrals").insert({
                     referrer_id: level3Ref.referrer_id,
                     referred_id: user.uid,
                     referred_email: user.email,
                     status: "active",
                     level: 3,
                     created_at: user.created_at
                   });
               }
           }
           console.log(`Successfully bridged tree for ${user.email}.`);
        }
    }
  }
  
  console.log("Migration complete.");
}

run().catch(console.error);
