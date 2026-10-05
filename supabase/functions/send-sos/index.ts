import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const key = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!key) throw new Error("Supabase secret key is not configured");
const db = createClient(url, key);

async function sendExpo(messages: unknown[]) {
  const headers: Record<string,string> = {"Content-Type":"application/json"};
  const expoToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (expoToken) headers.Authorization = `Bearer ${expoToken}`;
  const r = await fetch("https://exp.host/--/api/v2/push/send",{method:"POST",headers,body:JSON.stringify(messages)});
  const data = await r.json();
  if (!r.ok) throw new Error(data?.errors?.[0]?.message || "Expo push service failed");
  return data;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed",{status:405});
    const auth=req.headers.get("authorization")||"";
    const sessionToken=auth.startsWith("Bearer ")?auth.slice(7).trim():"";
    if(!sessionToken)return Response.json({error:"Missing session token"},{status:401});
    const {event_id}=await req.json();
    if(!event_id)return Response.json({error:"Missing event_id"},{status:400});

    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(sessionToken)))).map(b=>b.toString(16).padStart(2,"0")).join("");
    const {data:session,error:sessionError}=await db.from("sessions").select("account_id").eq("token_hash",hash).gt("expires_at",new Date().toISOString()).maybeSingle();
    if(sessionError||!session)return Response.json({error:"Session expired or invalid"},{status:401});

    const {data:event,error:eventError}=await db.from("sos_events").select("id,account_id,latitude,longitude,accuracy,created_at").eq("id",event_id).maybeSingle();
    if(eventError||!event||event.account_id!==session.account_id)return Response.json({error:"SOS event not found"},{status:404});

    const {data:account}=await db.from("accounts").select("username").eq("id",session.account_id).single();
    const username=account?.username||"A friend";
    const {data:shares}=await db.from("location_shares").select("owner_id,viewer_id").eq("status","active").or(`owner_id.eq.${session.account_id},viewer_id.eq.${session.account_id}`);
    const friendIds=[...new Set((shares||[]).map((x:any)=>x.owner_id===session.account_id?x.viewer_id:x.owner_id))].filter(Boolean);
    if(!friendIds.length)return Response.json({success:true,notified:0,message:"SOS recorded; no active friends."});

    const {data:tokens}=await db.from("push_tokens").select("account_id,expo_push_token").in("account_id",friendIds);
    const unique=[...new Map((tokens||[]).map((x:any)=>[x.expo_push_token,x])).values()];
    if(!unique.length)return Response.json({success:true,notified:0,message:"SOS recorded; friends have not enabled notifications."});

    const hasLocation=event.latitude!=null&&event.longitude!=null;
    const messages=unique.map((x:any)=>({
      to:x.expo_push_token,sound:"default",title:"🆘 SOS from "+username,
      body:username+" sent an SOS."+(hasLocation?" Location was captured for this SOS.":""),
      data:{type:"sos",event_id:event.id,latitude:event.latitude,longitude:event.longitude,accuracy:event.accuracy},
      priority:"high",channelId:"sos"
    }));
    const results=[];for(let i=0;i<messages.length;i+=100)results.push(await sendExpo(messages.slice(i,i+100)));
    return Response.json({success:true,notified:messages.length,results});
  }catch(e){return Response.json({error:e instanceof Error?e.message:"Unknown error"},{status:500})}
});