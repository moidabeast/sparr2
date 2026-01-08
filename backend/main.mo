import Array "mo:core/Array";
import List "mo:core/List";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import AccessControl "authorization/access-control";



actor {
  include MixinStorage();

  let accessControlState = AccessControl.initState();

  type RoomId = Text;
  type SessionId = Text;

  type Category = {
    #justChatting;
    #politics;
    #technology;
    #culture;
    #philosophy;
    #entertainment;
    #economics;
    #games;
    #conspiracy;
    #uncategorized;
  };

  type RoomRole = { #participant; #spectator };
  type Participant = { sessionId : SessionId; role : RoomRole };
  type MessageId = Nat;
  type SimulcastLayer = {
    quality : Text;
    resolution : Text;
    bitrate : Int;
  };
  type AudioPriorityMetrics = {
    isEnabled : Bool;
    effectivenessScore : Float;
    averagePriorityLevel : Int;
  };
  type FrameRateAdaptation = {
    currentFPS : Int;
    adaptationStatus : Text;
    networkCorrelation : [NetworkConditionCorrelation];
  };
  type KeyframeRequestStats = {
    requestCount : Int;
    optimizationSuccessRate : Float;
    averageRequestInterval : Int;
  };
  type BandwidthEstimationHistory = {
    feedbackData : [BandwidthFeedback];
    networkPacingStats : [NetworkPacingStat];
  };
  type NetworkConditionCorrelation = {
    networkType : Text;
    bandwidth : Int;
    adaptationEvent : Text;
  };
  type BandwidthFeedback = {
    timestamp : Time.Time;
    estimatedBandwidth : Int;
    lossRate : Float;
  };
  type NetworkPacingStat = {
    timestamp : Time.Time;
    pacingRate : Int;
  };
  type AdvancedStreamingOptimizationData = {
    simulcastLayerUsage : [SimulcastLayer];
    audioPriorityMetrics : AudioPriorityMetrics;
    frameRateAdaptation : FrameRateAdaptation;
    keyframeOptimizationStats : KeyframeRequestStats;
    bandwidthEstimationHistory : BandwidthEstimationHistory;
  };

  type Room = {
    id : RoomId;
    subject : Text;
    description : Text;
    thumbnail : Storage.ExternalBlob;
    createdAt : Time.Time;
    participantCount : Nat;
    category : Category;
  };

  module Room {
    public func compare(room1 : Room, room2 : Room) : Order.Order {
      Text.compare(room1.id, room2.id);
    };
  };

  type ChatMessage = {
    id : MessageId;
    sender : SessionId;
    content : Text;
    timestamp : Time.Time;
  };

  type SignalingMessage = {
    sender : SessionId;
    receiver : SessionId;
    messageType : Text;
    payload : Text;
  };

  type IcePolicy = {
    mode : Text;
    successRate : Int;
    lastSwitch : Time.Time;
  };

  type NetworkPathStats = {
    udpLatency : Int;
    tcpLatency : Int;
    packetLoss : Int;
    preferredRoute : Text;
  };

  type ConnectionMetrics = {
    peerId : SessionId;
    audioBitrate : Int;
    videoBitrate : Int;
    packetLoss : Float;
    audioJitter : Int;
    videoJitter : Int;
    latency : Int;
    retryCount : Nat;
    lastUpdated : Time.Time;
  };

  type IceCandidate = {
    candidateId : Text;
    candidateType : Text;
    isSelected : Bool;
    performance : {
      latency : Int;
      packetLoss : Float;
    };
  };

  type StateTransition = {
    previousState : Text;
    newState : Text;
    timestamp : Time.Time;
    stateDuration : Int;
  };

  type EventBadge = {
    eventType : Text;
    timestamp : Time.Time;
    mediaType : ?Text;
    outcome : ?Text;
  };

  type SessionEvent = {
    eventType : Text;
    timestamp : Time.Time;
    details : Text;
    severity : ?Text;
    peerId : ?SessionId;
  };

  type UploadSpeedTestResult = {
    sessionId : SessionId;
    measuredSpeedKbps : Int;
    qualityTier : Text;
    testTime : Time.Time;
  };

  type ContinuousUploadMeasurement = {
    sessionId : SessionId;
    speedKbps : Int;
    timestamp : Time.Time;
    qualityTier : Text;
  };

  type QualityAdjustmentEvent = {
    sessionId : SessionId;
    fromTier : Text;
    toTier : Text;
    triggerSpeedKbps : Int;
    timestamp : Time.Time;
  };

  type QualityTierStats = {
    totalDowngrades : Nat;
    totalUpgrades : Nat;
    avgTimeInTier : Int;
    currentTier : ?Text;
  };

  type UploadSpeedTestSummary = {
    sessionId : SessionId;
    totalTests : Nat;
    successfulTests : Nat;
    failedTests : Nat;
    avgSpeedKbps : Int;
    highestTierAchieved : ?Text;
  };

  type RealTimeQualityStatus = {
    currentTier : Text;
    currentSpeedKbps : Int;
    timeInCurrentTier : Time.Time;
    testsPassedInTier : Nat;
    testsFailedInTier : Nat;
  };

  type UploadSpeedStats = {
    lastTestedSpeedKbps : Int;
    avgSpeedKbps : Int;
    qualityTier : Text;
  };

  type UploadSpeedTestDebugData = {
    sessionId : SessionId;
    testResults : [UploadSpeedTestResult];
    continuousMeasurements : [ContinuousUploadMeasurement];
    adjustmentEvents : [QualityAdjustmentEvent];
    tierStats : [QualityTierStats];
    testSummary : ?UploadSpeedTestSummary;
    realTimeStatus : ?RealTimeQualityStatus;
    currentSpeedStats : ?UploadSpeedStats;
    lastTestTime : Time.Time;
  };

  type SpeedTestThresholds = {
    minStreamingKbps : Int;
    veryLowQualityMin : Int;
    lowQualityMin : Int;
    mediumQualityMin : Int;
    highQualityMin : Int;
  };

  type QualityTierThresholds = {
    veryLow : (Int, Int);
    low : (Int, Int);
    medium : (Int, Int);
    high : (Int, Int);
  };

  type TierChangeRange = {
    rangeKbps : (Int, Int);
    newTier : Text;
    adjustmentType : Text;
  };

  type SafariAudioPreference = {
    useSpeaker : Bool;
    lastToggled : Time.Time;
    iosDetection : Bool;
    compatibilityStatus : Bool;
    safariAudioTestResults : [SafariAudioTestResult];
  };

  type SafariAudioTestResult = {
    audioTestTime : Time.Time;
    testSuccess : Bool;
    browseDetection : Text;
    deviceId : Text;
    compatibilityNotes : Text;
  };

  type SafariAudioDebugData = {
    sessionId : SessionId;
    lastAudioTest : ?SafariAudioTestResult;
    testHistory : [SafariAudioTestResult];
    totalTests : Nat;
    safariTestSuccessRate : {
      totalTests : Nat;
      totalSuccess : Nat;
      failedTests : Nat;
      successRate : Float;
    };
    iosDetectionStats : {
      totalDetections : Nat;
      totalNonDetections : Nat;
      detectionRate : Float;
    };
  };

  type LobbyPreview = {
    roomId : RoomId;
    image : Storage.ExternalBlob;
    timestamp : Time.Time;
  };

  type LobbyPreviewMeta = {
    images : [Storage.ExternalBlob];
    isActive : Bool;
    lastUpdate : Time.Time;
  };

  type EmojiReaction = {
    sessionId : SessionId;
    emoji : Text;
    timestamp : Time.Time;
  };

  type UserProfile = {
    name : Text;
    avatar : Storage.ExternalBlob;
    sessionId : Text;
  };

  let rooms = Map.empty<RoomId, Room>();
  let roomParticipants = Map.empty<RoomId, List.List<Participant>>();
  let roomMessages = Map.empty<RoomId, List.List<ChatMessage>>();
  let signalingMessages = Map.empty<SessionId, List.List<SignalingMessage>>();
  let activePeers = Map.empty<RoomId, List.List<SessionId>>();
  let icePolicies = Map.empty<SessionId, IcePolicy>();
  let networkPathStats = Map.empty<SessionId, NetworkPathStats>();
  let connectionMetrics = Map.empty<SessionId, List.List<ConnectionMetrics>>();
  let iceCandidatesStore = Map.empty<SessionId, List.List<IceCandidate>>();
  let stateTransitions = Map.empty<SessionId, List.List<StateTransition>>();
  let eventBadges = Map.empty<SessionId, List.List<EventBadge>>();
  let sessionEvents = Map.empty<SessionId, List.List<SessionEvent>>();
  let advancedStreamingOptimizationData = Map.empty<SessionId, AdvancedStreamingOptimizationData>();
  let uploadSpeedTestResults = Map.empty<SessionId, List.List<UploadSpeedTestResult>>();
  let continuousUploadMeasurements = Map.empty<SessionId, List.List<ContinuousUploadMeasurement>>();
  let qualityAdjustmentEvents = Map.empty<SessionId, List.List<QualityAdjustmentEvent>>();
  let qualityTierStats = Map.empty<SessionId, List.List<QualityTierStats>>();
  let testSummaries = Map.empty<SessionId, UploadSpeedTestSummary>();
  let realTimeStatuses = Map.empty<SessionId, RealTimeQualityStatus>();
  let currentSpeedStats = Map.empty<SessionId, UploadSpeedStats>();
  let uploadSpeedTestConfig = Map.empty<SessionId, SpeedTestThresholds>();
  let tierChangeRanges = Map.empty<SessionId, List.List<TierChangeRange>>();
  let safariAudioPreferences = Map.empty<SessionId, SafariAudioPreference>();
  let lobbyPreviews = Map.empty<RoomId, LobbyPreviewMeta>();
  let roomReactions = Map.empty<RoomId, List.List<EmojiReaction>>();
  let defaultHeartbeatState = Map.empty<RoomId, Map.Map<SessionId, Bool>>();
  var heartbeatState = defaultHeartbeatState;
  let userProfiles = Map.empty<Principal, UserProfile>();

  let defaultThresholds : SpeedTestThresholds = {
    minStreamingKbps = 300;
    veryLowQualityMin = 300;
    lowQualityMin = 800;
    mediumQualityMin = 1500;
    highQualityMin = 3000;
  };

  let defaultQualityThresholds : QualityTierThresholds = {
    veryLow = (200, 400);
    low = (600, 1000);
    medium = (1400, 1700);
    high = (2800, 3200);
  };

  let defaultTierChangeRanges : TierChangeRange = {
    rangeKbps = (200, 400);
    newTier = "veryLow";
    adjustmentType = "downgrade";
  };

  var nextMessageId = 0;
  var nextRoomId = 0;
  var hasShutdown = false;
  var isBackgrounded = false;

  // ============================================================================
  // ACCESS CONTROL FUNCTIONS
  // ============================================================================

  public shared ({ caller }) func initializeAccessControl() : async () {
    AccessControl.initialize(accessControlState, caller);
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };

  // ============================================================================
  // USER PROFILE OPERATIONS (Anonymous imageboard - allow all users including guests)
  // ============================================================================

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    userProfiles.add(caller, profile);
  };

  // ============================================================================
  // PUBLIC ROOM OPERATIONS (Anonymous access allowed - Chattr style)
  // ============================================================================

  public shared ({ caller }) func createRoom(subject : Text, description : Text, thumbnailBlob : ?Storage.ExternalBlob, category : Category) : async Text {
    // Anonymous imageboard allows all users including guests to create rooms
    // No authorization check needed - this is intentional for Chattr-style anonymous access

    if (subject.isEmpty()) {
      Runtime.trap("Room subject cannot be empty");
    };
    if (description.isEmpty()) {
      Runtime.trap("Room description cannot be empty");
    };

    let roomId = "room_" # nextRoomId.toText();
    nextRoomId += 1;

    let thumbnail = switch (thumbnailBlob) {
      case (?blob) { blob };
      case (null) { "" : Storage.ExternalBlob };
    };

    let room : Room = {
      id = roomId;
      subject;
      description;
      thumbnail;
      createdAt = Time.now();
      participantCount = 0;
      category;
    };

    rooms.add(roomId, room);
    roomParticipants.add(roomId, List.empty<Participant>());
    roomMessages.add(roomId, List.empty<ChatMessage>());
    activePeers.add(roomId, List.empty<SessionId>());

    roomId;
  };

  public query func getRooms() : async [Room] {
    let roomsIter = rooms.values();
    roomsIter.toArray();
  };

  public query func getCategories() : async [(Category, Text)] {
    let categoryList : [(Category, Text)] = [
      (#economics, "https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795292/4_m7gsgm.png"),
      (#politics, "https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795284/1_lywcvr.png"),
      (#technology, "https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795282/5_hgbjk6.png"),
      (#philosophy, "https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795284/2_axojbp.png"),
      (#uncategorized, "https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795286/3_p8rlpk.png"),
      (#culture, "https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795288/6_j1t4kt.png"),
      (#justChatting, "https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795290/7_kgqsfd.png"),
      (#entertainment, "https://res.cloudinary.com/dbnj80s9g/image/upload/v1766795976/Copy_of_Extenda_10_Pica_wcdgfg.png"),
      (#games, "https://res.cloudinary.com/dbnj80s9g/image/upload/v1766907325/Copy_of_Extenda_10_Pica_z9yg0u.png"),
    ];
    categoryList;
  };

  public query func getRoom(roomId : RoomId) : async ?Room {
    rooms.get(roomId);
  };

  public query func getRoomsByCategory(category : Category) : async [Room] {
    let filteredRooms = rooms.toArray().filter(
      func((_, room)) {
        room.category == category;
      }
    );
    filteredRooms.map(func((_, room)) { room });
  };

  public query func getAllParticipants(roomId : RoomId) : async [Participant] {
    switch (roomParticipants.get(roomId)) {
      case (null) { [] };
      case (?participants) { participants.toArray() };
    };
  };

  public func joinRoom(roomId : RoomId, sessionId : SessionId, role : RoomRole) : async Bool {
    if (sessionId.isEmpty()) { return false };
    switch (rooms.get(roomId)) {
      case (null) { false };
      case (?room) {
        let currentParticipants = switch (roomParticipants.get(roomId)) {
          case (null) { List.empty<Participant>() };
          case (?participants) { participants };
        };
        let alreadyJoined = currentParticipants.any(func(p) { p.sessionId == sessionId });

        if (not alreadyJoined) {
          let newParticipant : Participant = {
            sessionId;
            role;
          };
          currentParticipants.add(newParticipant);
          roomParticipants.add(roomId, currentParticipants);

          if (role == #participant) {
            let currentPeers = switch (activePeers.get(roomId)) {
              case (null) { List.empty<SessionId>() };
              case (?peers) { peers };
            };
            let peerExists = currentPeers.any(func(p) { p == sessionId });
            if (not peerExists) {
              currentPeers.add(sessionId);
              activePeers.add(roomId, currentPeers);

              for (existingPeer in currentPeers.values()) {
                if (existingPeer != sessionId) {
                  let notificationMessage = {
                    sender = sessionId;
                    receiver = existingPeer;
                    messageType = "peer_joined";
                    payload = sessionId;
                  };
                  let existingMessages = switch (signalingMessages.get(existingPeer)) {
                    case (null) { List.empty<SignalingMessage>() };
                    case (?messages) { messages };
                  };
                  existingMessages.add(notificationMessage);
                  signalingMessages.add(existingPeer, existingMessages);
                };
              };
            };
          };

          let updatedRoom = {
            id = room.id;
            subject = room.subject;
            description = room.description;
            thumbnail = room.thumbnail;
            createdAt = room.createdAt;
            participantCount = room.participantCount + 1;
            category = room.category;
          };
          rooms.add(roomId, updatedRoom);
        };
        true;
      };
    };
  };

  public func leaveRoom(roomId : RoomId, sessionId : SessionId) : async Bool {
    switch (rooms.get(roomId)) {
      case (null) { false };
      case (?room) {
        let currentParticipants = switch (roomParticipants.get(roomId)) {
          case (null) { List.empty<Participant>() };
          case (?participants) { participants };
        };
        let updatedParticipants = currentParticipants.filter(func(p) { p.sessionId != sessionId });
        roomParticipants.add(roomId, updatedParticipants);

        let currentPeers = switch (activePeers.get(roomId)) {
          case (null) { List.empty<SessionId>() };
          case (?peers) { peers };
        };
        let updatedPeers = currentPeers.filter(func(p) { p != sessionId });
        activePeers.add(roomId, updatedPeers);

        for (remainingPeer in updatedPeers.values()) {
          let notificationMessage = {
            sender = sessionId;
            receiver = remainingPeer;
            messageType = "peer_left";
            payload = sessionId;
          };
          let existingMessages = switch (signalingMessages.get(remainingPeer)) {
            case (null) { List.empty<SignalingMessage>() };
            case (?messages) { messages };
          };
          existingMessages.add(notificationMessage);
          signalingMessages.add(remainingPeer, existingMessages);
        };

        let newCount = if (room.participantCount > 0) {
          room.participantCount - 1 : Nat;
        } else { room.participantCount };

        let updatedRoom = {
          id = room.id;
          subject = room.subject;
          description = room.description;
          thumbnail = room.thumbnail;
          createdAt = room.createdAt;
          participantCount = newCount;
          category = room.category;
        };
        rooms.add(roomId, updatedRoom);

        true;
      };
    };
  };

  public query func getActivePeers(roomId : RoomId) : async [SessionId] {
    switch (activePeers.get(roomId)) {
      case (null) { [] };
      case (?peers) { peers.toArray() };
    };
  };

  // ============================================================================
  // CATEGORY MANAGEMENT (Admin-only for moderation)
  // ============================================================================

  func getCategoryOrder(category : Category) : Nat {
    switch (category) {
      case (#justChatting) { 0 };
      case (#politics) { 1 };
      case (#technology) { 2 };
      case (#culture) { 3 };
      case (#philosophy) { 4 };
      case (#entertainment) { 5 };
      case (#economics) { 6 };
      case (#games) { 7 };
      case (#conspiracy) { 8 };
      case (#uncategorized) { 9 };
    };
  };

  public func getCategoryCounts() : async [(Category, Nat)] {
    let categories = [
      #justChatting,
      #politics,
      #technology,
      #culture,
      #philosophy,
      #entertainment,
      #economics,
      #games,
      #conspiracy,
      #uncategorized,
    ];

    let sortedCategories = categories.sort(
      func(a, b) {
        let orderA = getCategoryOrder(a);
        let orderB = getCategoryOrder(b);
        Nat.compare(orderA, orderB);
      }
    );

    sortedCategories.map(
      func(category) {
        let count = rooms.toArray().filter(func((_, room)) { room.category == category }).size();
        (category, count);
      }
    );
  };

  public shared ({ caller }) func updateRoomCategory(roomId : RoomId, category : Category) : async Bool {
    // Admin-only: Only admins can update room categories for content moderation
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update room categories");
    };

    switch (rooms.get(roomId)) {
      case (null) { false };
      case (?room) {
        let updatedRoom = {
          id = room.id;
          subject = room.subject;
          description = room.description;
          thumbnail = room.thumbnail;
          createdAt = room.createdAt;
          participantCount = room.participantCount;
          category;
        };
        rooms.add(roomId, updatedRoom);
        true;
      };
    };
  };

  // ============================================================================
  // PUBLIC MESSAGING OPERATIONS (Anonymous access allowed - Chattr style)
  // ============================================================================

  public func sendMessage(roomId : RoomId, sessionId : SessionId, content : Text) : async MessageId {
    if (sessionId.isEmpty()) {
      Runtime.trap("Session ID cannot be empty");
    };
    if (content.isEmpty()) {
      Runtime.trap("Message content cannot be empty");
    };

    switch (rooms.get(roomId)) {
      case (null) {
        Runtime.trap("Room does not exist");
      };
      case (?_room) {
        let messageId = nextMessageId;
        nextMessageId += 1;

        let message : ChatMessage = {
          id = messageId;
          sender = sessionId;
          content = content;
          timestamp = Time.now();
        };

        let currentMessages = switch (roomMessages.get(roomId)) {
          case (null) { List.empty<ChatMessage>() };
          case (?messages) { messages };
        };
        currentMessages.add(message);
        roomMessages.add(roomId, currentMessages);

        messageId;
      };
    };
  };

  public query func getMessages(roomId : RoomId) : async [ChatMessage] {
    switch (roomMessages.get(roomId)) {
      case (null) { [] };
      case (?messages) { messages.toArray() };
    };
  };

  public func broadcastLiveMessage(_roomId : RoomId, _sessionId : SessionId, _content : Text) : async () {
    ();
  };

  // ============================================================================
  // PUBLIC WEBRTC SIGNALING OPERATIONS (Anonymous access allowed - Chattr style)
  // ============================================================================

  public func sendSignalingMessage(sender : SessionId, receiver : SessionId, messageType : Text, payload : Text) : async () {
    let message : SignalingMessage = {
      sender;
      receiver;
      messageType;
      payload;
    };

    let currentMessages = switch (signalingMessages.get(receiver)) {
      case (null) { List.empty<SignalingMessage>() };
      case (?messages) { messages };
    };
    currentMessages.add(message);
    signalingMessages.add(receiver, currentMessages);
  };

  public query func getSignalingMessages(sessionId : SessionId) : async [SignalingMessage] {
    switch (signalingMessages.get(sessionId)) {
      case (null) { [] };
      case (?messages) { messages.toArray() };
    };
  };

  public func clearSignalingMessages(sessionId : SessionId) : async () {
    signalingMessages.add(sessionId, List.empty<SignalingMessage>());
  };

  // ============================================================================
  // PUBLIC SESSION MANAGEMENT (Anonymous access allowed - Chattr style)
  // ============================================================================

  public func updateHeartbeat(_sessionId : SessionId, _roomId : RoomId) : async () {
    ();
  };

  // ============================================================================
  // PUBLIC LIVE PREVIEW OPERATIONS (Anonymous access allowed - Chattr style)
  // ============================================================================

  public func storeLivePreview(roomId : RoomId, previewBlob : Storage.ExternalBlob) : async () {
    switch (rooms.get(roomId)) {
      case (null) {
        Runtime.trap("Room does not exist");
      };
      case (?_room) {
        let currentPreview = {
          images = [previewBlob];
          isActive = true;
          lastUpdate = Time.now();
        };
        lobbyPreviews.add(roomId, currentPreview);
      };
    };
  };

  public query func getLivePreview(roomId : RoomId) : async ?Storage.ExternalBlob {
    switch (lobbyPreviews.get(roomId)) {
      case (null) { null };
      case (?preview) {
        if (not preview.images.isEmpty()) {
          ?preview.images[0];
        } else {
          null;
        };
      };
    };
  };

  // ============================================================================
  // PUBLIC METRICS AND DEBUG OPERATIONS (Anonymous access allowed - Chattr style)
  // ============================================================================

  public func storeConnectionMetrics(sessionId : SessionId, metrics : ConnectionMetrics) : async () {
    let currentMetrics = switch (connectionMetrics.get(sessionId)) {
      case (null) { List.empty<ConnectionMetrics>() };
      case (?metrics) { metrics };
    };
    currentMetrics.add(metrics);
    connectionMetrics.add(sessionId, currentMetrics);
  };

  public query func getConnectionMetrics(sessionId : SessionId) : async [ConnectionMetrics] {
    switch (connectionMetrics.get(sessionId)) {
      case (null) { [] };
      case (?metrics) { metrics.toArray() };
    };
  };

  public func storeSessionEvent(sessionId : SessionId, event : SessionEvent) : async () {
    let currentEvents = switch (sessionEvents.get(sessionId)) {
      case (null) { List.empty<SessionEvent>() };
      case (?events) { events };
    };
    currentEvents.add(event);
    sessionEvents.add(sessionId, currentEvents);
  };

  public query func getSessionEvents(sessionId : SessionId) : async [SessionEvent] {
    switch (sessionEvents.get(sessionId)) {
      case (null) { [] };
      case (?events) { events.toArray() };
    };
  };

  public query func getCategoryCountsPublic() : async [(Category, Nat)] {
    let categories = [
      #justChatting,
      #politics,
      #technology,
      #culture,
      #philosophy,
      #entertainment,
      #economics,
      #games,
      #conspiracy,
      #uncategorized,
    ];

    let sortedCategories = categories.sort(
      func(a, b) {
        let orderA = getCategoryOrder(a);
        let orderB = getCategoryOrder(b);
        Nat.compare(orderA, orderB);
      }
    );

    sortedCategories.map(
      func(category) {
        let count = rooms.toArray().filter(func((_, room)) { room.category == category }).size();
        (category, count);
      }
    );
  };
};





VERSION 384 (CURRENT VERSION -- PARTICIPANTS UNABLE TO SEE/HEAR EACH OTHER):

import List "mo:core/List";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Debug "mo:core/Debug";
import Order "mo:core/Order";

import Storage "blob-storage/Storage";
import AccessControl "authorization/access-control";
import RoleAssignment "role-assignment";
import Signaling "signaling";

actor {
  // Placeholder: Threaded reply integration point

  type UserProfile = {
    name : Text;
    avatar : ?Storage.ExternalBlob;
  };

  type RoomId = Text;
  type SessionId = Text;
  type Category = {
    #justChatting;
    #politics;
    #technology;
    #culture;
    #philosophy;
    #entertainment;
    #economics;
    #games;
    #conspiracy;
    #uncategorized;
  };
  type RoomRole = { #participant; #spectator };
  type Participant = {
    sessionId : SessionId;
    username : Text;
    avatar : ?Storage.ExternalBlob;
    role : RoomRole;
  };
  type MessageId = Nat;
  type SimulcastLayer = {
    quality : Text;
    resolution : Text;
    bitrate : Int;
  };
  type AudioPriorityMetrics = {
    isEnabled : Bool;
    effectivenessScore : Float;
    averagePriorityLevel : Int;
  };
  type FrameRateAdaptation = {
    currentFPS : Int;
    adaptationStatus : Text;
    networkCorrelation : [NetworkConditionCorrelation];
  };
  type KeyframeRequestStats = {
    requestCount : Int;
    optimizationSuccessRate : Float;
    averageRequestInterval : Int;
  };
  type BandwidthEstimationHistory = {
    feedbackData : [BandwidthFeedback];
    networkPacingStats : [NetworkPacingStat];
  };
  type NetworkConditionCorrelation = {
    networkType : Text;
    bandwidth : Int;
    adaptationEvent : Text;
  };
  type BandwidthFeedback = {
    timestamp : Time.Time;
    estimatedBandwidth : Int;
    lossRate : Float;
  };
  type NetworkPacingStat = {
    timestamp : Time.Time;
    pacingRate : Int;
  };
  type AdvancedStreamingOptimizationData = {
    simulcastLayerUsage : [SimulcastLayer];
    audioPriorityMetrics : AudioPriorityMetrics;
    frameRateAdaptation : FrameRateAdaptation;
    keyframeOptimizationStats : KeyframeRequestStats;
    bandwidthEstimationHistory : BandwidthEstimationHistory;
  };
  type Room = {
    id : RoomId;
    subject : Text;
    thumbnail : Storage.ExternalBlob;
    createdAt : Time.Time;
    participantCount : Nat;
    category : Category;
    creator : ?Principal;
    creatorUsername : Text;
    creatorAvatar : ?Storage.ExternalBlob;
  };
  module Room {
    public func compare(room1 : Room, room2 : Room) : Order.Order {
      Text.compare(room1.id, room2.id);
    };
  };
  type ChatMessage = {
    id : MessageId;
    sender : Text;
    content : Text;
    timestamp : Time.Time;
    username : Text;
    avatar : ?Storage.ExternalBlob;
  };
  type SignalingMessage = {
    sender : SessionId;
    receiver : SessionId;
    messageType : Text;
    payload : Text;
  };
  type IcePolicy = {
    mode : Text;
    successRate : Int;
    lastSwitch : Time.Time;
  };
  type NetworkPathStats = {
    udpLatency : Int;
    tcpLatency : Int;
    packetLoss : Int;
    preferredRoute : Text;
  };
  type ConnectionMetrics = {
    peerId : SessionId;
    audioBitrate : Int;
    videoBitrate : Int;
    packetLoss : Float;
    audioJitter : Int;
    videoJitter : Int;
    latency : Int;
    retryCount : Nat;
    lastUpdated : Time.Time;
  };
  type IceCandidate = {
    candidateId : Text;
    candidateType : Text;
    isSelected : Bool;
    performance : {
      latency : Int;
      packetLoss : Float;
    };
  };
  type StateTransition = {
    previousState : Text;
    newState : Text;
    timestamp : Time.Time;
    stateDuration : Int;
  };
  type EventBadge = {
    eventType : Text;
    timestamp : Time.Time;
    mediaType : ?Text;
    outcome : ?Text;
  };
  type SessionEvent = {
    eventType : Text;
    timestamp : Time.Time;
    details : Text;
    severity : ?Text;
    peerId : ?SessionId;
  };
  type UploadSpeedTestResult = {
    sessionId : SessionId;
    measuredSpeedKbps : Int;
    qualityTier : Text;
    testTime : Time.Time;
  };
  type ContinuousUploadMeasurement = {
    sessionId : SessionId;
    speedKbps : Int;
    timestamp : Time.Time;
    qualityTier : Text;
  };
  type QualityAdjustmentEvent = {
    sessionId : SessionId;
    fromTier : Text;
    toTier : Text;
    triggerSpeedKbps : Int;
    timestamp : Time.Time;
  };
  type QualityTierStats = {
    totalDowngrades : Nat;
    totalUpgrades : Nat;
    avgTimeInTier : Int;
    currentTier : ?Text;
  };
  type UploadSpeedTestSummary = {
    sessionId : SessionId;
    totalTests : Nat;
    successfulTests : Nat;
    failedTests : Nat;
    avgSpeedKbps : Int;
    highestTierAchieved : ?Text;
  };
  type RealTimeQualityStatus = {
    currentTier : Text;
    currentSpeedKbps : Int;
    timeInCurrentTier : Time.Time;
    testsPassedInTier : Nat;
    testsFailedInTier : Nat;
  };
  type UploadSpeedStats = {
    lastTestedSpeedKbps : Int;
    avgSpeedKbps : Int;
    qualityTier : Text;
  };
  type UploadSpeedTestDebugData = {
    sessionId : SessionId;
    testResults : [UploadSpeedTestResult];
    continuousMeasurements : [ContinuousUploadMeasurement];
    adjustmentEvents : [QualityAdjustmentEvent];
    tierStats : [QualityTierStats];
    testSummary : ?UploadSpeedTestSummary;
    realTimeStatus : ?RealTimeQualityStatus;
    currentSpeedStats : ?UploadSpeedStats;
    lastTestTime : Time.Time;
  };
  type SpeedTestThresholds = {
    minStreamingKbps : Int;
    veryLowQualityMin : Int;
    lowQualityMin : Int;
    mediumQualityMin : Int;
    highQualityMin : Int;
  };
  type QualityTierThresholds = {
    veryLow : (Int, Int);
    low : (Int, Int);
    medium : (Int, Int);
    high : (Int, Int);
  };
  type TierChangeRange = {
    rangeKbps : (Int, Int);
    newTier : Text;
    adjustmentType : Text;
  };
  type SafariAudioPreference = {
    useSpeaker : Bool;
    lastToggled : Time.Time;
    iosDetection : Bool;
    compatibilityStatus : Bool;
    safariAudioTestResults : [SafariAudioTestResult];
  };
  type SafariAudioTestResult = {
    audioTestTime : Time.Time;
    testSuccess : Bool;
    browseDetection : Text;
    deviceId : Text;
    compatibilityNotes : Text;
  };
  type SafariAudioDebugData = {
    sessionId : SessionId;
    lastAudioTest : ?SafariAudioTestResult;
    testHistory : [SafariAudioTestResult];
    totalTests : Nat;
    safariTestSuccessRate : {
      totalTests : Nat;
      totalSuccess : Nat;
      failedTests : Nat;
      successRate : Float;
    };
    iosDetectionStats : {
      totalDetections : Nat;
      totalNonDetections : Nat;
      detectionRate : Float;
    };
  };
  type LobbyPreview = {
    roomId : RoomId;
    image : ?Storage.ExternalBlob;
    timestamp : Time.Time;
  };
  type LobbyPreviewMeta = {
    images : [Storage.ExternalBlob];
    isActive : Bool;
    lastUpdate : Time.Time;
  };
  type EmojiReaction = {
    emoji : Text;
    timestamp : Time.Time;
    creator : ?Principal;
    username : Text;
    avatar : ?Storage.ExternalBlob;
  };
  type FeedRoom = {
    id : RoomId;
    title : Text;
    creator : Text;
    video : ?Storage.ExternalBlob;
    description : Text;
    username : Text;
    avatar : ?Storage.ExternalBlob;
  };
  type ClipId = Nat;
  type Clip = {
    id : ClipId;
    title : Text;
    roomId : RoomId;
    creatorUsername : Text;
    creatorAvatar : ?Storage.ExternalBlob;
    video : Storage.ExternalBlob;
  };
  type UploadCertificate = {
    method : Text;
    blob_hash : Text;
  };

  let accessControlState = AccessControl.initState();
  let roleAssignmentState = RoleAssignment.new();
  let signalingState = Signaling.new();
  let rooms = Map.empty<RoomId, Room>();
  let roomParticipants = Map.empty<RoomId, List.List<Participant>>();
  let roomMessages = Map.empty<RoomId, List.List<ChatMessage>>();
  let signalingMessages = Map.empty<SessionId, List.List<SignalingMessage>>();
  let activePeers = Map.empty<RoomId, List.List<SessionId>>();
  let icePolicies = Map.empty<SessionId, IcePolicy>();
  let networkPathStats = Map.empty<SessionId, NetworkPathStats>();
  let connectionMetrics = Map.empty<SessionId, List.List<ConnectionMetrics>>();
  let iceCandidatesStore = Map.empty<SessionId, List.List<IceCandidate>>();
  let stateTransitions = Map.empty<SessionId, List.List<StateTransition>>();
  let eventBadges = Map.empty<SessionId, List.List<EventBadge>>();
  let sessionEvents = Map.empty<RoomId, List.List<SessionEvent>>(); // Room-based event tracking.
  let advancedStreamingOptimizationData = Map.empty<SessionId, AdvancedStreamingOptimizationData>();
  let uploadSpeedTestResults = Map.empty<SessionId, List.List<UploadSpeedTestResult>>();
  let continuousUploadMeasurements = Map.empty<SessionId, List.List<ContinuousUploadMeasurement>>();
  let qualityAdjustmentEvents = Map.empty<SessionId, List.List<QualityAdjustmentEvent>>();
  let qualityTierStats = Map.empty<SessionId, List.List<QualityTierStats>>();
  let testSummaries = Map.empty<SessionId, UploadSpeedTestSummary>();
  let realTimeStatuses = Map.empty<SessionId, RealTimeQualityStatus>();
  let currentSpeedStats = Map.empty<SessionId, UploadSpeedStats>();
  let uploadSpeedTestConfig = Map.empty<SessionId, SpeedTestThresholds>();
  let tierChangeRanges = Map.empty<SessionId, List.List<TierChangeRange>>();
  let safariAudioPreferences = Map.empty<SessionId, SafariAudioPreference>();
  let lobbyPreviews = Map.empty<RoomId, LobbyPreviewMeta>();
  let roomReactions = Map.empty<RoomId, List.List<EmojiReaction>>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let clipsStore = Map.empty<ClipId, Clip>();
  let defaultThresholds : SpeedTestThresholds = {
    minStreamingKbps = 300;
    veryLowQualityMin = 300;
    lowQualityMin = 800;
    mediumQualityMin = 1500;
    highQualityMin = 3000;
  };
  let defaultQualityThresholds : QualityTierThresholds = {
    veryLow = (200, 400);
    low = (600, 1000);
    medium = (1400, 1700);
    high = (2800, 3200);
  };
  let defaultTierChangeRanges : TierChangeRange = {
    rangeKbps = (200, 400);
    newTier = "veryLow";
    adjustmentType = "downgrade";
  };
  let connectedUsers = Map.empty<RoomId, List.List<Principal>>();
  type OldParticipant = { username : Text; avatar : ?Storage.ExternalBlob };
  var nextMessageId = 0;
  var nextRoomId = 0;
  var hasShutdown = false;
  var isBackgrounded = false;
  var nextClipId = 0;

  //----------------------------------------------------------------//
  // ACCESS CONTROL FUNCTIONS
  //----------------------------------------------------------------//

  public shared ({ caller }) func initializeAccessControl() : async () {
    AccessControl.initialize(accessControlState, caller);
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };

  //----------------------------------------------------------------//
  // GET MESSAGES (No auth required)
  //----------------------------------------------------------------//

  // This function wraps the `Signaling.getPendingMessages` logic from the `signaling` module.
  // It retrieves pending offers, answers, and candidates for the caller.
  public query ({ caller }) func getMessages(_roomId : Text) : async Signaling.PendingMessages {
    { offers = []; answers = []; candidates = [] };
  };
};




