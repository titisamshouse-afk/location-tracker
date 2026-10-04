import React,{useEffect,useRef,useState}from"react";
import{Alert,Linking,Modal,Platform,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,TouchableOpacity,View}from"react-native";
import*as Location from"expo-location";
import*as TaskManager from"expo-task-manager";
import*as SecureStore from"expo-secure-store";
import{createClient}from"@supabase/supabase-js";
import MapView,{Marker}from"react-native-maps";

const URL="https://qiwfbgswukaixyhlzekw.supabase.co";
const KEY="sb_publishable_bAIMCv0YQnAsWv_ppNzWhQ_uSRRFyTC";
const TASK="location-tracker-background-location";
const PRIVACY_URL="https://titisamshouse-afk.github.io/location-tracker/privacy.html";
const sb=createClient(URL,KEY);

TaskManager.defineTask(TASK,async({data,error})=>{
  if(error||!data?.locations?.length)return;
  const token=await SecureStore.getItemAsync("lt_token");
  if(!token)return;
  const l=data.locations[data.locations.length-1];
  await sb.rpc("save_my_location",{p_token:token,p_lat:l.coords.latitude,p_lng:l.coords.longitude,p_accuracy:l.coords.accuracy??null});
});

async function startSharing(){
  const f=await Location.requestForegroundPermissionsAsync();
  if(f.status!=="granted")throw Error("Location permission is required.");
  const b=await Location.requestBackgroundPermissionsAsync();
  if(b.status!=="granted")throw Error(Platform.OS==="ios"?"Allow Always location in Settings.":"Allow background location.");
  if(await Location.hasStartedLocationUpdatesAsync(TASK))return;
  const o={accuracy:Location.Accuracy.High,distanceInterval:0,timeInterval:5000,pausesUpdatesAutomatically:false};
  if(Platform.OS==="android")o.foregroundService={notificationTitle:"Location Tracker",notificationBody:"Your location is being shared every 5 seconds."};
  await Location.startLocationUpdatesAsync(TASK,o);
}
async function stopSharing(){
  if(await Location.hasStartedLocationUpdatesAsync(TASK))await Location.stopLocationUpdatesAsync(TASK);
}
function formatUpdated(value){
  if(!value)return"No location update yet";
  const sec=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));
  if(sec<10)return"Updated just now";
  if(sec<60)return"Updated "+sec+"s ago";
  return"Updated "+Math.floor(sec/60)+"m ago";
}

export default function App(){
  const[token,setToken]=useState(null),[username,setUsername]=useState(""),[loginUser,setLoginUser]=useState(""),[loginPass,setLoginPass]=useState(""),
    [sharing,setSharing]=useState(false),[friends,setFriends]=useState([]),[err,setErr]=useState(""),
    [friendName,setFriendName]=useState(""),[addOpen,setAddOpen]=useState(false),[addMsg,setAddMsg]=useState(""),
    [findMsg,setFindMsg]=useState(""),[authMode,setAuthMode]=useState("login"),[privacyAccepted,setPrivacyAccepted]=useState(false),
    [createUser,setCreateUser]=useState(""),[createPass,setCreatePass]=useState(""),[createMsg,setCreateMsg]=useState(""),map=useRef(null);

  useEffect(()=>{(async()=>{
    setToken(await SecureStore.getItemAsync("lt_token"));
    setUsername(await SecureStore.getItemAsync("lt_user")||"");
  })()},[]);

  useEffect(()=>{
    if(!token)return;
    refresh();
    const i=setInterval(refresh,5000);
    return()=>clearInterval(i);
  },[token]);

  async function refresh(){
    if(!token)return;
    const a=await sb.rpc("my_location_status",{p_token:token});
    if(!a.error)setSharing(!!a.data?.sharing);
    const f=await sb.rpc("list_friends",{p_token:token});
    if(!f.error){
      const seen=new Set();
      const unique=(f.data||[]).filter(x=>{
        const k=String(x.id);
        if(seen.has(k))return false;
        seen.add(k);return true;
      });
      setFriends(unique);
    }
  }

  async function login(){
    setErr("");
    const r=await sb.rpc("login_account",{p_username:loginUser.trim(),p_password:loginPass});
    if(r.error){setErr(r.error.message);return}
    await SecureStore.setItemAsync("lt_token",r.data.token);
    await SecureStore.setItemAsync("lt_user",r.data.username);
    setToken(r.data.token);setUsername(r.data.username);
  }

  async function createAccount(){
    setCreateMsg("");
    const name=createUser.trim();
    if(!privacyAccepted){setCreateMsg("You must read and agree to the Privacy Policy before creating an account.");return}
    if(!name||!createPass){setCreateMsg("Enter a username and password.");return}
    if(createPass.length<6){setCreateMsg("Password must be at least 6 characters.");return}
    const r=await sb.rpc("create_account",{p_username:name,p_password:createPass});
    if(r.error){setCreateMsg(r.error.message);return}
    if(!r.data?.token){setCreateMsg("Account created, but no login session was returned. Please log in.");setAuthMode("login");setLoginUser(name);setLoginPass("");return}
    await SecureStore.setItemAsync("lt_token",r.data.token);
    await SecureStore.setItemAsync("lt_user",r.data.username||name);
    setToken(r.data.token);setUsername(r.data.username||name);
    setCreateUser("");setCreatePass("");setPrivacyAccepted(false);setCreateMsg("");
  }

  async function share(){
    try{setErr("");await startSharing();setSharing(true);await refresh()}
    catch(e){setErr(e.message)}
  }
  async function unshare(){
    try{await stopSharing();const r=await sb.rpc("stop_my_location",{p_token:token});if(r.error)throw Error(r.error.message);setSharing(false)}
    catch(e){setErr(e.message)}
  }
  async function findMe(){
    try{
      setFindMsg("Finding your location…");
      const p=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});
      map.current?.animateToRegion({latitude:p.coords.latitude,longitude:p.coords.longitude,latitudeDelta:.01,longitudeDelta:.01},700);
      setFindMsg("Found you. Accuracy ±"+Math.round(p.coords.accuracy||0)+" m.");
    }catch(e){setFindMsg("Could not find you: "+e.message)}
  }
  function findFriend(friend){
    if(friend.latitude==null||friend.longitude==null){setFindMsg(friend.username+" has no location yet.");return}
    map.current?.animateToRegion({latitude:+friend.latitude,longitude:+friend.longitude,latitudeDelta:.01,longitudeDelta:.01},700);
    setFindMsg("Showing "+friend.username+"'s latest location.");
  }
  async function addFriend(){
    const name=friendName.trim();
    if(!name){setAddMsg("Enter a username.");return}
    setAddMsg("Adding friend…");
    const r=await sb.rpc("add_friend",{p_token:token,p_friend_username:name});
    if(r.error){setAddMsg(r.error.message);return}
    setAddMsg("Friend added!");setFriendName("");await refresh();
    setTimeout(()=>{setAddOpen(false);setAddMsg("")},500);
  }
  async function removeFriend(friend){
    Alert.alert("Remove friend?","Remove "+friend.username+" from your friends?",[
      {text:"Cancel",style:"cancel"},
      {text:"Remove",style:"destructive",onPress:async()=>{
        const r=await sb.rpc("remove_friend",{p_token:token,p_friend_id:friend.id});
        if(r.error)Alert.alert("Error",r.error.message);else refresh();
      }}
    ]);
  }
  async function logout(){
    await stopSharing().catch(()=>{});
    await sb.rpc("logout_account",{p_token:token});
    await SecureStore.deleteItemAsync("lt_token");await SecureStore.deleteItemAsync("lt_user");
    setToken(null);setUsername("");
  }

  if(!token&&authMode==="login")return <SafeAreaView style={s.auth}>
    <Text style={s.title}>Location Tracker</Text>
    <Text style={s.subtitle}>Sign in to see your friends and share your location.</Text>
    <TextInput style={s.input} placeholder="Username" value={loginUser} onChangeText={setLoginUser} autoCapitalize="none"/>
    <TextInput style={s.input} placeholder="Password" value={loginPass} onChangeText={setLoginPass} secureTextEntry/>
    {err?<Text style={s.err}>{err}</Text>:null}
    <Btn t="Log in" f={login}/>
    <TouchableOpacity style={s.linkButton} onPress={()=>{setAuthMode("create");setCreateMsg("");setPrivacyAccepted(false)}}><Text style={s.link}>Create an account</Text></TouchableOpacity>
  </SafeAreaView>;

  if(!token&&authMode==="create")return <SafeAreaView style={s.safe}>
    <ScrollView contentContainerStyle={s.authCreate}>
      <Text style={s.title}>Create your account</Text>
      <Text style={s.subtitle}>Please review the privacy and location-sharing information before creating an account.</Text>
      <View style={s.policyBox}>
        <Text style={s.policyTitle}>Privacy & Location Consent</Text>
        <Text style={s.policyText}>Location Tracker may collect your username, account/session information, friend relationships, and device location information such as latitude, longitude, accuracy, and the time of a location update.</Text>
        <Text style={s.policyText}>Your location is used to show you and let friends you choose see your current or last-known location when sharing is enabled. If you grant background location permission, the mobile app may collect location while running in the background and requests updates approximately every 5 seconds. Your device may delay updates.</Text>
        <Text style={s.policyText}>Only add people you trust. Do not use Location Tracker to secretly monitor or track another person without their knowledge and permission.</Text>
        <Text style={s.policyText}>Location Tracker uses Supabase to store and process account, friend, session, and location information. You can stop sharing, remove friends, revoke location permission, stop using the service, or request account deletion.</Text>
        <Text style={s.policyText}>No Internet service can guarantee complete security. Parents or guardians should supervise a child's use of location-sharing features and permissions.</Text>
        <TouchableOpacity onPress={()=>Linking.openURL(PRIVACY_URL)}><Text style={s.link}>Read the full Privacy Policy</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={s.checkRow} onPress={()=>setPrivacyAccepted(!privacyAccepted)} activeOpacity={.8}>
        <View style={[s.checkbox,privacyAccepted&&s.checkboxChecked]}>{privacyAccepted?<Text style={s.checkmark}>✓</Text>:null}</View>
        <Text style={s.checkText}>I have read and agree to the Privacy Policy and understand how location sharing works.</Text>
      </TouchableOpacity>
      <TextInput style={s.input} placeholder="Username" value={createUser} onChangeText={setCreateUser} autoCapitalize="none" maxLength={32}/>
      <TextInput style={s.input} placeholder="Password (6+ characters)" value={createPass} onChangeText={setCreatePass} secureTextEntry/>
      {createMsg?<Text style={s.err}>{createMsg}</Text>:null}
      <Btn t="Create account" f={createAccount}/>
      <TouchableOpacity style={s.linkButton} onPress={()=>{setAuthMode("login");setCreateMsg("")}}><Text style={s.link}>Back to log in</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;

  return <SafeAreaView style={s.safe}>
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.header}>
        <View><Text style={s.title}>Location Tracker</Text><Text style={s.muted}>Signed in as {username}</Text></View>
        <TouchableOpacity onPress={logout}><Text style={s.logout}>Log out</Text></TouchableOpacity>
      </View>
      <MapView ref={map} style={s.map} initialRegion={{latitude:39,longitude:-104.8,latitudeDelta:8,longitudeDelta:8}} showsUserLocation showsMyLocationButton>
        {friends.map(f=>f.latitude!=null&&f.longitude!=null?
          <Marker key={String(f.id)} coordinate={{latitude:+f.latitude,longitude:+f.longitude}} title={f.username}
            description={f.sharing?"Sharing location • "+formatUpdated(f.updated_at):"Last known location • "+formatUpdated(f.updated_at)}/>:null)}
      </MapView>
      <View style={s.card}>
        <View style={s.rowBetween}><View><Text style={s.sectionTitle}>🔎 Find</Text><Text style={s.muted}>Quickly locate yourself or a friend.</Text></View><TouchableOpacity style={s.secondary} onPress={findMe}><Text style={s.secondaryText}>Find me</Text></TouchableOpacity></View>
        {findMsg?<Text style={s.success}>{findMsg}</Text>:null}
        <Text style={s.label}>Friends</Text>
        {friends.map(f=><TouchableOpacity key={"find-"+f.id} style={s.findRow} onPress={()=>findFriend(f)}><Text style={s.friendName}>{f.username}</Text><Text style={s.small}>{f.latitude!=null&&f.longitude!=null?(f.sharing?"📍 Sharing • ":"📌 Last known • ")+formatUpdated(f.updated_at):"No location yet"}  ›</Text></TouchableOpacity>)}
        {!friends.length?<Text style={s.muted}>Add a friend below to find them.</Text>:null}
      </View>
      <View style={s.card}>
        <View style={s.rowBetween}><View><Text style={s.sectionTitle}>Friends <Text style={s.count}>{friends.length}</Text></Text></View><TouchableOpacity style={s.secondary} onPress={()=>{setAddOpen(true);setAddMsg("")}}><Text style={s.secondaryText}>＋ Add friend</Text></TouchableOpacity></View>
        {friends.map(f=><View key={String(f.id)} style={s.friendRow}>
          <View style={{flex:1}}><Text style={s.friendName}>{f.username}</Text><Text style={f.sharing?s.online:s.offline}>{f.sharing?"● Sharing location • "+formatUpdated(f.updated_at):f.updated_at?"● Last known location • "+formatUpdated(f.updated_at):"● No location yet"}</Text></View>
          <View style={s.friendButtons}><TouchableOpacity style={s.smallBtn} disabled={f.latitude==null||f.longitude==null} onPress={()=>findFriend(f)}><Text style={s.smallBtnText}>{f.latitude!=null&&f.longitude!=null?"View":"Info"}</Text></TouchableOpacity><TouchableOpacity style={s.removeBtn} onPress={()=>removeFriend(f)}><Text style={s.removeText}>Remove</Text></TouchableOpacity></View>
        </View>)}
        {!friends.length?<Text style={s.muted}>No friends yet. Add someone by username.</Text>:null}
      </View>
      <View style={s.card}>
        <Text style={s.status}>{sharing?"🟢 Sharing location every 5 seconds":"⚪ Not sharing"}</Text>
        {sharing?<Btn t="Stop sharing" f={unshare}/>:<Btn t="Start sharing every 5 seconds" f={share}/>}
        <Text style={s.muted}>The app requests background GPS updates about every 5 seconds. Android may delay updates to save battery.</Text>
        {err?<Text style={s.err}>{err}</Text>:null}
      </View>
    </ScrollView>
    <Modal visible={addOpen} transparent animationType="fade" onRequestClose={()=>setAddOpen(false)}>
      <View style={s.modalBg}><View style={s.modal}>
        <View style={s.rowBetween}><Text style={s.sectionTitle}>Add a friend</Text><TouchableOpacity onPress={()=>setAddOpen(false)}><Text style={s.close}>×</Text></TouchableOpacity></View>
        <Text style={s.muted}>Enter their exact Location Tracker username.</Text>
        <TextInput style={s.input} placeholder="Username" value={friendName} onChangeText={setFriendName} autoCapitalize="none" maxLength={32}/>
        {addMsg?<Text style={addMsg==="Friend added!"?s.success:s.err}>{addMsg}</Text>:null}
        <Btn t="Add friend" f={addFriend}/>
      </View></View>
    </Modal>
  </SafeAreaView>;
}
function Btn({t,f}){return <TouchableOpacity style={s.btn} onPress={f}><Text style={s.bt}>{t}</Text></TouchableOpacity>}
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#f3f4f6"},content:{paddingBottom:30},auth:{flex:1,justifyContent:"center",padding:24,backgroundColor:"#f3f4f6"},authCreate:{padding:24,paddingBottom:40},
  header:{padding:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},title:{fontSize:26,fontWeight:"800"},subtitle:{fontSize:15,color:"#6b7280",marginBottom:14},
  muted:{color:"#6b7280",paddingVertical:4},input:{backgroundColor:"#fff",borderWidth:1,borderColor:"#ddd",borderRadius:12,padding:14,marginVertical:7},
  map:{height:380},card:{backgroundColor:"#fff",margin:10,padding:14,borderRadius:14},rowBetween:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},sectionTitle:{fontSize:20,fontWeight:"800"},
  secondary:{backgroundColor:"#e5e7eb",paddingVertical:10,paddingHorizontal:12,borderRadius:10},secondaryText:{fontWeight:"800"},label:{fontWeight:"700",marginTop:14,marginBottom:5},
  findRow:{paddingVertical:11,borderBottomWidth:1,borderBottomColor:"#eee"},friendRow:{flexDirection:"row",alignItems:"center",paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#eee"},friendName:{fontSize:16,fontWeight:"700"},
  small:{fontSize:12,color:"#6b7280"},online:{fontSize:12,color:"#15803d",marginTop:3},offline:{fontSize:12,color:"#6b7280",marginTop:3},friendButtons:{flexDirection:"row",gap:6},
  smallBtn:{paddingVertical:8,paddingHorizontal:10,borderRadius:9,backgroundColor:"#e5e7eb"},smallBtnText:{fontWeight:"700"},removeBtn:{paddingVertical:8,paddingHorizontal:9,borderRadius:9,borderWidth:1,borderColor:"#ef4444"},removeText:{color:"#dc2626",fontWeight:"700"},
  count:{fontSize:14,color:"#6b7280"},status:{fontWeight:"800",marginBottom:5},btn:{backgroundColor:"#111827",padding:15,borderRadius:12,marginVertical:8,alignItems:"center"},bt:{color:"#fff",fontWeight:"800"},
  err:{color:"#b91c1c",paddingVertical:7},success:{color:"#15803d",paddingVertical:7},logout:{color:"#b91c1c",fontWeight:"700"},close:{fontSize:30,lineHeight:30},
  modalBg:{flex:1,backgroundColor:"rgba(0,0,0,.45)",justifyContent:"center",padding:20},modal:{backgroundColor:"#fff",borderRadius:18,padding:18},
  linkButton:{alignItems:"center",padding:10},link:{color:"#2563eb",fontWeight:"700"},policyBox:{backgroundColor:"#fff",borderWidth:1,borderColor:"#ddd",borderRadius:14,padding:14,marginBottom:12},
  policyTitle:{fontSize:18,fontWeight:"800",marginBottom:6},policyText:{fontSize:13,color:"#374151",lineHeight:19,marginBottom:9},checkRow:{flexDirection:"row",alignItems:"flex-start",marginVertical:8},
  checkbox:{width:25,height:25,borderWidth:2,borderColor:"#9ca3af",borderRadius:6,marginRight:10,alignItems:"center",justifyContent:"center"},checkboxChecked:{backgroundColor:"#111827",borderColor:"#111827"},
  checkmark:{color:"#fff",fontWeight:"900",fontSize:17},checkText:{flex:1,fontSize:14,lineHeight:20,color:"#111827"}
});