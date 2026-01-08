import Array "mo:core/Array";
import List "mo:core/List";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Float "mo:core/Float";
import Iter "mo:core/Iter";
import Order "mo:core/Order";

import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";

actor {
  include MixinStorage();

  type RoomId = Text;
  type SessionId = Text;
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

  type SessionDebugData = {
    sessionId : SessionId;
    exportStart : Time.Time;
    exportEnd : Time.Time;
    metricsHistory : [ConnectionMetrics];
    iceCandidates : [IceCandidate];
    stateTransitions : [StateTransition];
    eventBadges : [EventBadge];
    sessionEvents : [SessionEvent];
    networkStats : ?NetworkPathStats;
    advancedStreamingOptimizationData : ?AdvancedStreamingOptimizationData;
    uploadSpeedTestDebugData : ?UploadSpeedTestDebugData;
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

  let rooms = Map.empty<RoomId, Room>();
  let roomParticipants = Map.empty<RoomId, List.List<SessionId>>();
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

  let defaultHeartbeatState = Map.empty<RoomId, Map.Map<SessionId, Bool>>();
  var heartbeatState = defaultHeartbeatState;

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
  var hasShutdown = false; // Indicates whether the shutdown procedure has been initiated.
  var isBackgrounded = false;

  public shared ({ caller }) func createRoom(subject : Text, description : Text, thumbnail : Storage.ExternalBlob) : async RoomId {
    let roomId = subject.concat(Time.now().toText());
    let room : Room = {
      id = roomId;
      subject;
      description;
      thumbnail;
      createdAt = Time.now();
      participantCount = 0;
    };
    rooms.add(roomId, room);
    roomParticipants.add(roomId, List.empty<SessionId>());
    roomMessages.add(roomId, List.empty<ChatMessage>());
    activePeers.add(roomId, List.empty<SessionId>());
    roomId;
  };

  public query ({ caller }) func getRooms() : async [Room] {
    rooms.values().toArray().sort();
  };

  public query ({ caller }) func getRoom(roomId : RoomId) : async ?Room {
    rooms.get(roomId);
  };

  public shared ({ caller }) func joinRoom(roomId : RoomId, sessionId : SessionId) : async () {
    switch (rooms.get(roomId)) {
      case (null) { return () };
      case (?room) {
        let participants = switch (roomParticipants.get(roomId)) {
          case (null) { List.empty<SessionId>() };
          case (?list) { list };
        };
        if (participants.contains(sessionId)) {
          return ();
        };
        participants.add(sessionId);
        roomParticipants.add(roomId, participants);
        let updatedRoom = {
          room with
          participantCount = participants.size();
        };
        rooms.add(roomId, updatedRoom);
      };
    };
  };

  public shared ({ caller }) func leaveRoom(roomId : RoomId, sessionId : SessionId) : async () {
    switch (rooms.get(roomId)) {
      case (null) { () };
      case (?room) {
        let participants = switch (roomParticipants.get(roomId)) {
          case (null) { List.empty<SessionId>() };
          case (?list) { list };
        };
        if (not participants.contains(sessionId)) { return () };

        let filteredParticipants = participants.filter(func(p) { p != sessionId });
        roomParticipants.add(roomId, filteredParticipants);

        let updatedRoom = { room with participantCount = filteredParticipants.size() };
        rooms.add(roomId, updatedRoom);
      };
    };
  };

  public shared ({ caller }) func sendMessage(roomId : RoomId, sessionId : SessionId, content : Text) : async () {
    switch (rooms.get(roomId)) {
      case (null) { return () };
      case (?_) {
        let message : ChatMessage = {
          id = nextMessageId;
          sender = sessionId;
          content;
          timestamp = Time.now();
        };
        nextMessageId += 1;
        let messages = switch (roomMessages.get(roomId)) {
          case (null) { List.empty<ChatMessage>() };
          case (?list) { list };
        };
        messages.add(message);
        roomMessages.add(roomId, messages);
      };
    };
  };

  public query ({ caller }) func getMessages(roomId : RoomId) : async [ChatMessage] {
    switch (roomMessages.get(roomId)) {
      case (null) { [] };
      case (?messages) { messages.toArray() };
    };
  };

  public shared ({ caller }) func sendSignalingMessage(sender : SessionId, receiver : SessionId, messageType : Text, payload : Text) : async () {
    let message : SignalingMessage = {
      sender;
      receiver;
      messageType;
      payload;
    };
    let messages = switch (signalingMessages.get(receiver)) {
      case (null) { List.empty<SignalingMessage>() };
      case (?list) { list };
    };
    messages.add(message);
    signalingMessages.add(receiver, messages);
  };

  public query ({ caller }) func getSignalingMessages(sessionId : SessionId) : async [SignalingMessage] {
    switch (signalingMessages.get(sessionId)) {
      case (null) { [] };
      case (?messages) { messages.toArray() };
    };
  };

  public shared ({ caller }) func clearSignalingMessages(sessionId : SessionId) : async () {
    signalingMessages.remove(sessionId);
  };

  public shared ({ caller }) func addActivePeer(roomId : RoomId, sessionId : SessionId) : async () {
    let peers = switch (activePeers.get(roomId)) {
      case (null) { List.empty<SessionId>() };
      case (?list) { list };
    };
    if (not peers.contains(sessionId)) {
      peers.add(sessionId);
      activePeers.add(roomId, peers);
    };
  };

  public shared ({ caller }) func removeActivePeer(roomId : RoomId, sessionId : SessionId) : async () {
    let peers = switch (activePeers.get(roomId)) {
      case (null) { List.empty<SessionId>() };
      case (?list) { list };
    };
    let filteredPeers = peers.filter(func(p) { p != sessionId });
    activePeers.add(roomId, filteredPeers);
  };

  public query ({ caller }) func getActivePeers(roomId : RoomId) : async [SessionId] {
    switch (activePeers.get(roomId)) {
      case (null) { [] };
      case (?peers) { peers.toArray() };
    };
  };

  public shared ({ caller }) func updateIcePolicy(sessionId : SessionId, mode : Text, successRate : Int) : async () {
    let policy : IcePolicy = {
      mode;
      successRate;
      lastSwitch = Time.now();
    };
    icePolicies.add(sessionId, policy);
  };

  public query ({ caller }) func getIcePolicy(sessionId : SessionId) : async ?IcePolicy {
    icePolicies.get(sessionId);
  };

  public shared ({ caller }) func updateNetworkPathStats(sessionId : SessionId, udpLatency : Int, tcpLatency : Int, packetLoss : Int, preferredRoute : Text) : async () {
    let stats : NetworkPathStats = {
      udpLatency;
      tcpLatency;
      packetLoss;
      preferredRoute;
    };
    networkPathStats.add(sessionId, stats);
  };

  public query ({ caller }) func getNetworkPathStats(sessionId : SessionId) : async ?NetworkPathStats {
    networkPathStats.get(sessionId);
  };

  public shared ({ caller }) func addConnectionMetrics(sessionId : SessionId, metrics : ConnectionMetrics) : async () {
    let existingHistory = switch (connectionMetrics.get(sessionId)) {
      case (null) { List.empty<ConnectionMetrics>() };
      case (?history) { history };
    };
    existingHistory.add(metrics);
    connectionMetrics.add(sessionId, existingHistory);
  };

  public query ({ caller }) func getConnectionMetrics(sessionId : SessionId) : async [ConnectionMetrics] {
    switch (connectionMetrics.get(sessionId)) {
      case (null) { [] };
      case (?history) { history.toArray() };
    };
  };

  public shared ({ caller }) func addIceCandidate(sessionId : SessionId, candidate : IceCandidate) : async () {
    let existingCandidates = switch (iceCandidatesStore.get(sessionId)) {
      case (null) { List.empty<IceCandidate>() };
      case (?candidates) { candidates };
    };
    existingCandidates.add(candidate);
    iceCandidatesStore.add(sessionId, existingCandidates);
  };

  public query ({ caller }) func getIceCandidates(sessionId : SessionId) : async [IceCandidate] {
    switch (iceCandidatesStore.get(sessionId)) {
      case (null) { [] };
      case (?candidates) { candidates.toArray() };
    };
  };

  public shared ({ caller }) func addStateTransition(sessionId : SessionId, transition : StateTransition) : async () {
    let existingTransitions = switch (stateTransitions.get(sessionId)) {
      case (null) { List.empty<StateTransition>() };
      case (?transitions) { transitions };
    };
    existingTransitions.add(transition);
    stateTransitions.add(sessionId, existingTransitions);
  };

  public query ({ caller }) func getStateTransitions(sessionId : SessionId) : async [StateTransition] {
    switch (stateTransitions.get(sessionId)) {
      case (null) { [] };
      case (?transitions) { transitions.toArray() };
    };
  };

  public shared ({ caller }) func addEventBadge(sessionId : SessionId, badge : EventBadge) : async () {
    let existingBadges = switch (eventBadges.get(sessionId)) {
      case (null) { List.empty<EventBadge>() };
      case (?badges) { badges };
    };
    existingBadges.add(badge);
    eventBadges.add(sessionId, existingBadges);
  };

  public query ({ caller }) func getEventBadges(sessionId : SessionId) : async [EventBadge] {
    switch (eventBadges.get(sessionId)) {
      case (null) { [] };
      case (?badges) { badges.toArray() };
    };
  };

  public shared ({ caller }) func logSessionEvent(sessionId : SessionId, event : SessionEvent) : async () {
    let existingEvents = switch (sessionEvents.get(sessionId)) {
      case (null) { List.empty<SessionEvent>() };
      case (?events) { events };
    };
    existingEvents.add(event);
    sessionEvents.add(sessionId, existingEvents);
  };

  public query ({ caller }) func getSessionEvents(sessionId : SessionId) : async [SessionEvent] {
    switch (sessionEvents.get(sessionId)) {
      case (null) { [] };
      case (?events) { events.toArray() };
    };
  };

  public shared ({ caller }) func updateAdvancedStreamingOptimizationData(sessionId : SessionId, data : AdvancedStreamingOptimizationData) : async () {
    advancedStreamingOptimizationData.add(sessionId, data);
  };

  public query ({ caller }) func getAdvancedStreamingOptimizationData(sessionId : SessionId) : async ?AdvancedStreamingOptimizationData {
    advancedStreamingOptimizationData.get(sessionId);
  };

  public query ({ caller }) func getSessionDebugData(sessionId : SessionId, startTime : Time.Time, endTime : Time.Time) : async ?SessionDebugData {
    let allMetrics : [ConnectionMetrics] = switch (connectionMetrics.get(sessionId)) {
      case (null) { [] };
      case (?history) { history.toArray() };
    };
    let filteredMetrics = allMetrics.filter(
      func(metrics) { metrics.lastUpdated >= startTime and metrics.lastUpdated <= endTime }
    );

    let allCandidates : [IceCandidate] = switch (iceCandidatesStore.get(sessionId)) {
      case (null) { [] };
      case (?candidates) { candidates.toArray() };
    };

    let allTransitions : [StateTransition] = switch (stateTransitions.get(sessionId)) {
      case (null) { [] };
      case (?transitions) { transitions.toArray() };
    };
    let filteredTransitions = allTransitions.filter(
      func(transition) { transition.timestamp >= startTime and transition.timestamp <= endTime }
    );

    let allBadges : [EventBadge] = switch (eventBadges.get(sessionId)) {
      case (null) { [] };
      case (?badges) { badges.toArray() };
    };
    let filteredBadges = allBadges.filter(
      func(badge) { badge.timestamp >= startTime and badge.timestamp <= endTime }
    );

    let allEvents : [SessionEvent] = switch (sessionEvents.get(sessionId)) {
      case (null) { [] };
      case (?events) { events.toArray() };
    };
    let filteredEvents = allEvents.filter(
      func(event) { event.timestamp >= startTime and event.timestamp <= endTime }
    );

    let networkStats = switch (networkPathStats.get(sessionId)) {
      case (null) { null };
      case (?stats) { ?stats };
    };

    let advancedStreamingData = switch (advancedStreamingOptimizationData.get(sessionId)) {
      case (null) { null };
      case (?data) { ?data };
    };

    let timeFilteredArray = func<A>(array : [A], timestampGet : A -> Time.Time) : [A] {
      array.filter(
        func(entry) { timestampGet(entry) >= startTime and timestampGet(entry) <= endTime }
      );
    };

    let testResults = switch (uploadSpeedTestResults.get(sessionId)) {
      case (null) { [] };
      case (?results) {
        timeFilteredArray(results.toArray(), func(result) { result.testTime });
      };
    };

    let continuousMeasurements = switch (continuousUploadMeasurements.get(sessionId)) {
      case (null) { [] };
      case (?measurements) {
        timeFilteredArray(measurements.toArray(), func(measurement) { measurement.timestamp });
      };
    };

    let adjustmentEvents = switch (qualityAdjustmentEvents.get(sessionId)) {
      case (null) { [] };
      case (?events) {
        timeFilteredArray(events.toArray(), func(event) { event.timestamp });
      };
    };

    let tierStats = switch (qualityTierStats.get(sessionId)) {
      case (null) { [] };
      case (?stats) { stats.toArray() };
    };

    let testSummary = switch (testSummaries.get(sessionId)) {
      case (null) { null };
      case (?summary) { ?summary };
    };

    let realTimeStatus = switch (realTimeStatuses.get(sessionId)) {
      case (null) { null };
      case (?status) { ?status };
    };

    let currentSpeed = switch (currentSpeedStats.get(sessionId)) {
      case (null) { null };
      case (?stats) { ?stats };
    };

    var lastTestTime = switch (testResults.size()) {
      case (0) {
        switch (continuousMeasurements.size()) {
          case (0) { Time.now() };
          case (_) { continuousMeasurements[continuousMeasurements.size() - 1].timestamp };
        };
      };
      case (_) { testResults[testResults.size() - 1].testTime };
    };

    ?{
      sessionId;
      exportStart = startTime;
      exportEnd = endTime;
      metricsHistory = filteredMetrics;
      iceCandidates = allCandidates;
      stateTransitions = filteredTransitions;
      eventBadges = filteredBadges;
      sessionEvents = filteredEvents;
      networkStats;
      advancedStreamingOptimizationData = advancedStreamingData;
      uploadSpeedTestDebugData = ?{
        sessionId;
        testResults;
        continuousMeasurements;
        adjustmentEvents;
        tierStats;
        testSummary;
        realTimeStatus;
        currentSpeedStats = currentSpeed;
        lastTestTime;
      };
    };
  };

  public shared ({ caller }) func saveUploadSpeedTestResult(sessionId : SessionId, speedKbps : Int, qualityTier : Text) : async () {
    let result : UploadSpeedTestResult = {
      sessionId;
      measuredSpeedKbps = speedKbps;
      qualityTier;
      testTime = Time.now();
    };
    let existingResults = switch (uploadSpeedTestResults.get(sessionId)) {
      case (null) { List.empty<UploadSpeedTestResult>() };
      case (?results) { results };
    };
    existingResults.add(result);
    uploadSpeedTestResults.add(sessionId, existingResults);
  };

  public shared ({ caller }) func saveContinuousUploadMeasurement(sessionId : SessionId, speedKbps : Int, qualityTier : Text) : async () {
    let measurement : ContinuousUploadMeasurement = {
      sessionId;
      speedKbps;
      timestamp = Time.now();
      qualityTier;
    };
    let existingMeasurements = switch (continuousUploadMeasurements.get(sessionId)) {
      case (null) { List.empty<ContinuousUploadMeasurement>() };
      case (?measurements) { measurements };
    };
    existingMeasurements.add(measurement);
    continuousUploadMeasurements.add(sessionId, existingMeasurements);
  };

  public shared ({ caller }) func saveQualityAdjustmentEvent(sessionId : SessionId, fromTier : Text, toTier : Text, triggerSpeedKbps : Int) : async () {
    let event : QualityAdjustmentEvent = {
      sessionId;
      fromTier;
      toTier;
      triggerSpeedKbps;
      timestamp = Time.now();
    };
    let existingEvents = switch (qualityAdjustmentEvents.get(sessionId)) {
      case (null) { List.empty<QualityAdjustmentEvent>() };
      case (?events) { events };
    };
    existingEvents.add(event);
    qualityAdjustmentEvents.add(sessionId, existingEvents);
  };

  public shared ({ caller }) func saveQualityTierStats(sessionId : SessionId, totalDowngrades : Nat, totalUpgrades : Nat, avgTimeInTier : Int, currentTier : ?Text) : async () {
    let stats : QualityTierStats = {
      totalDowngrades;
      totalUpgrades;
      avgTimeInTier;
      currentTier;
    };
    let existingStats = switch (qualityTierStats.get(sessionId)) {
      case (null) { List.empty<QualityTierStats>() };
      case (?tierStats) { tierStats };
    };
    existingStats.add(stats);
    qualityTierStats.add(sessionId, existingStats);
  };

  public shared ({ caller }) func saveTestSummary(sessionId : SessionId, totalTests : Nat, successfulTests : Nat, failedTests : Nat, avgSpeedKbps : Int, highestTierAchieved : ?Text) : async () {
    let summary : UploadSpeedTestSummary = {
      sessionId;
      totalTests;
      successfulTests;
      failedTests;
      avgSpeedKbps;
      highestTierAchieved;
    };
    testSummaries.add(sessionId, summary);
  };

  public shared ({ caller }) func saveRealTimeStatus(sessionId : SessionId, currentTier : Text, currentSpeedKbps : Int, timeInCurrentTier : Time.Time, testsPassedInTier : Nat, testsFailedInTier : Nat) : async () {
    let status : RealTimeQualityStatus = {
      currentTier;
      currentSpeedKbps;
      timeInCurrentTier;
      testsPassedInTier;
      testsFailedInTier;
    };
    realTimeStatuses.add(sessionId, status);
  };

  public shared ({ caller }) func saveCurrentSpeedStats(sessionId : SessionId, lastTestedSpeedKbps : Int, avgSpeedKbps : Int, qualityTier : Text) : async () {
    let stats : UploadSpeedStats = {
      lastTestedSpeedKbps;
      avgSpeedKbps;
      qualityTier;
    };
    currentSpeedStats.add(sessionId, stats);
  };

  public shared ({ caller }) func setUploadSpeedTestConfig(sessionId : SessionId, tresholds : SpeedTestThresholds) : async () {
    uploadSpeedTestConfig.add(sessionId, tresholds);
  };

  public shared ({ caller }) func saveTierChangeRanges(sessionId : SessionId, ranges : [TierChangeRange]) : async () {
    let rangesData = List.fromArray<TierChangeRange>(ranges);
    tierChangeRanges.add(sessionId, rangesData);
  };

  public shared ({ caller }) func resetUploadSpeedTestConfig(sessionId : SessionId) : async () {
    uploadSpeedTestConfig.remove(sessionId);
    tierChangeRanges.remove(sessionId);
  };

  public query ({ caller }) func getUploadSpeedTestConfig(sessionId : SessionId) : async ?SpeedTestThresholds {
    uploadSpeedTestConfig.get(sessionId);
  };

  public query ({ caller }) func getTierChangeRanges(sessionId : SessionId) : async [TierChangeRange] {
    switch (tierChangeRanges.get(sessionId)) {
      case (null) { [defaultTierChangeRanges] };
      case (?ranges) { ranges.toArray() };
    };
  };

  public query ({ caller }) func getUploadSpeedTestDebugData(sessionId : SessionId, startTime : Time.Time, endTime : Time.Time) : async ?UploadSpeedTestDebugData {
    let timeFilteredArray = func<A>(array : [A], timestampGet : A -> Time.Time) : [A] {
      array.filter(
        func(entry) { timestampGet(entry) >= startTime and timestampGet(entry) <= endTime }
      );
    };

    let testResults = switch (uploadSpeedTestResults.get(sessionId)) {
      case (null) { [] };
      case (?results) {
        timeFilteredArray(results.toArray(), func(result) { result.testTime });
      };
    };

    let continuousMeasurements = switch (continuousUploadMeasurements.get(sessionId)) {
      case (null) { [] };
      case (?measurements) {
        timeFilteredArray(measurements.toArray(), func(measurement) { measurement.timestamp });
      };
    };

    let adjustmentEvents = switch (qualityAdjustmentEvents.get(sessionId)) {
      case (null) { [] };
      case (?events) {
        timeFilteredArray(events.toArray(), func(event) { event.timestamp });
      };
    };

    let tierStats = switch (qualityTierStats.get(sessionId)) {
      case (null) { [] };
      case (?stats) { stats.toArray() };
    };

    let testSummary = switch (testSummaries.get(sessionId)) {
      case (null) { null };
      case (?summary) { ?summary };
    };

    let realTimeStatus = switch (realTimeStatuses.get(sessionId)) {
      case (null) { null };
      case (?status) { ?status };
    };

    let currentSpeed = switch (currentSpeedStats.get(sessionId)) {
      case (null) { null };
      case (?stats) { ?stats };
    };

    var lastTestTime = switch (testResults.size()) {
      case (0) {
        switch (continuousMeasurements.size()) {
          case (0) { Time.now() };
          case (_) { continuousMeasurements[continuousMeasurements.size() - 1].timestamp };
        };
      };
      case (_) { testResults[testResults.size() - 1].testTime };
    };

    ?{
      sessionId;
      testResults;
      continuousMeasurements;
      adjustmentEvents;
      tierStats;
      testSummary;
      realTimeStatus;
      currentSpeedStats = currentSpeed;
      lastTestTime;
    };
  };

  public shared ({ caller }) func setSafariAudioPreference(sessionId : SessionId, useSpeaker : Bool, iosDetection : Bool, compatibilityStatus : Bool) : async () {
    let preference : SafariAudioPreference = {
      useSpeaker;
      lastToggled = Time.now();
      iosDetection;
      compatibilityStatus;
      safariAudioTestResults = [];
    };
    safariAudioPreferences.add(sessionId, preference);
  };

  public shared ({ caller }) func advancedSetSafariAudioPreference(sessionId : SessionId, useSpeaker : Bool, iosDetection : Bool, compatibilityStatus : Bool, safariAudioTestResults : [SafariAudioTestResult]) : async () {
    let preference : SafariAudioPreference = {
      useSpeaker;
      lastToggled = Time.now();
      iosDetection;
      compatibilityStatus;
      safariAudioTestResults;
    };
    safariAudioPreferences.add(sessionId, preference);
  };

  public shared ({ caller }) func recordSafariAudioTest(sessionId : SessionId, testResult : SafariAudioTestResult, useSpeaker : Bool, iosDetection : Bool, compatibilityStatus : Bool) : async () {
    let preference = switch (safariAudioPreferences.get(sessionId)) {
      case (null) {
        {
          useSpeaker;
          lastToggled = Time.now();
          iosDetection;
          compatibilityStatus;
          safariAudioTestResults = [testResult];
        };
      };
      case (?existing) {
        let currentHistory = existing.safariAudioTestResults;
        {
          useSpeaker;
          lastToggled = Time.now();
          iosDetection;
          compatibilityStatus;
          safariAudioTestResults = currentHistory.concat([testResult]);
        };
      };
    };
    safariAudioPreferences.add(sessionId, preference);
  };

  public shared ({ caller }) func updateLastToggled(sessionId : SessionId) : async () {
    let preference = switch (safariAudioPreferences.get(sessionId)) {
      case (null) {
        {
          useSpeaker = false;
          lastToggled = Time.now();
          iosDetection = false;
          compatibilityStatus = false;
          safariAudioTestResults = [];
        };
      };
      case (?existing) {
        {
          useSpeaker = existing.useSpeaker;
          lastToggled = Time.now();
          iosDetection = existing.iosDetection;
          compatibilityStatus = existing.compatibilityStatus;
          safariAudioTestResults = existing.safariAudioTestResults;
        };
      };
    };
    safariAudioPreferences.add(sessionId, preference);
  };

  public query ({ caller }) func getSafariAudioPreference(sessionId : SessionId) : async ?SafariAudioPreference {
    safariAudioPreferences.get(sessionId);
  };

  public query ({ caller }) func getSafariAudioDebugData(sessionId : SessionId, startTime : Time.Time, endTime : Time.Time) : async ?SafariAudioDebugData {
    switch (safariAudioPreferences.get(sessionId)) {
      case (null) { null };
      case (?preference) {
        let filteredTestResults = preference.safariAudioTestResults.filter(
          func(result) { result.audioTestTime >= startTime and result.audioTestTime <= endTime }
        );

        let lastTest = if (filteredTestResults.size() > 0) {
          ?filteredTestResults[filteredTestResults.size() - 1];
        } else { null };

        let resultLen = filteredTestResults.size();
        var successfulTestCount = 0;
        var failedTestCount = 0;

        let _ = filteredTestResults.filter(
          func(result) {
            if (result.testSuccess) { successfulTestCount += 1 }
            else { failedTestCount += 1 };
            true;
          }
        );
        let successRate = if (resultLen > 0) {
          successfulTestCount.toFloat() / resultLen.toFloat();
        } else { 0.0 };

        var successfulDetections = 0;
        var failedDetections = 0;
        let _ = filteredTestResults.filter(
          func(result) {
            if (preference.iosDetection) { successfulDetections += 1 }
            else { failedDetections += 1 };
            true;
          }
        );
        let detectionRate = if (filteredTestResults.size() > 0) {
          successfulDetections.toFloat() / filteredTestResults.size().toFloat();
        } else { 0.0 };

        ?{
          sessionId;
          lastAudioTest = lastTest;
          testHistory = filteredTestResults;
          totalTests = filteredTestResults.size();
          safariTestSuccessRate = {
            totalTests = filteredTestResults.size();
            totalSuccess = successfulTestCount;
            failedTests = failedTestCount;
            successRate;
          };
          iosDetectionStats = {
            totalDetections = filteredTestResults.size();
            totalNonDetections = failedDetections;
            detectionRate;
          };
        };
      };
    };
  };

  type PresenceStatus = {
    sessionId : SessionId;
    isVisible : Bool;
    isAlive : Bool;
    lastHeartbeat : Time.Time;
  };

  let roomPresences = Map.empty<RoomId, Map.Map<SessionId, PresenceStatus>>();

  public shared ({ caller }) func updatePresence(roomId : RoomId, sessionId : SessionId, isVisible : Bool) : async () {
    let presence : PresenceStatus = {
      sessionId;
      isVisible;
      isAlive = true;
      lastHeartbeat = Time.now();
    };

    // Store presence in room-level map
    let currentMap = switch (roomPresences.get(roomId)) {
      case (null) { Map.empty<SessionId, PresenceStatus>() };
      case (?map) { map };
    };
    currentMap.add(sessionId, presence);
    roomPresences.add(roomId, currentMap);
  };

  public shared ({ caller }) func sendHeartbeat(roomId : RoomId, sessionId : SessionId) : async Bool {
    switch (roomPresences.get(roomId)) {
      case (null) { false };
      case (?roomMap) {
        switch (roomMap.get(sessionId)) {
          case (null) { false };
          case (?presence) {
            // Update heartbeat timestamp, keep visibility state
            let updatedPresence = { presence with lastHeartbeat = Time.now() };
            roomMap.add(sessionId, updatedPresence);
            true;
          };
        };
      };
    };
  };

  public shared ({ caller }) func refreshPresence(roomId : RoomId, sessionId : SessionId, isVisible : Bool) : async Bool {
    switch (roomPresences.get(roomId)) {
      case (null) { false };
      case (?roomMap) {
        switch (roomMap.get(sessionId)) {
          case (null) { false };
          case (?presence) {
            // Update heartbeat and visibility in one shot
            let refreshedPresence = {
              presence with
              isVisible;
              lastHeartbeat = Time.now();
            };
            roomMap.add(sessionId, refreshedPresence);
            true;
          };
        };
      };
    };
  };

  public query ({ caller }) func checkPresence(roomId : RoomId, sessionId : SessionId) : async ?PresenceStatus {
    switch (roomPresences.get(roomId)) {
      case (null) { null };
      case (?roomMap) { roomMap.get(sessionId) };
    };
  };

  public query ({ caller }) func getRoomPresences(roomId : RoomId) : async [PresenceStatus] {
    switch (roomPresences.get(roomId)) {
      case (null) { [] };
      case (?roomMap) {
        roomMap.values().toArray();
      };
    };
  };

  public shared ({ caller }) func disconnect(roomId : RoomId, sessionId : SessionId) : async Bool {
    switch (roomPresences.get(roomId)) {
      case (null) { false };
      case (?roomMap) {
        switch (roomMap.get(sessionId)) {
          case (null) { false };
          case (?_) {
            // Remove presence entry on disconnect
            roomMap.remove(sessionId);
            true;
          };
        };
      };
    };
  };

  func cleanStalePresences(roomId : RoomId, timeoutNanos : Int) : () {
    let now = Time.now();

    switch (roomPresences.get(roomId)) {
      case (null) {};
      case (?roomMap) {
        let filteredPresences = roomMap.filter(
          func(_sessionId, presence) {
            (now - presence.lastHeartbeat) <= timeoutNanos;
          }
        );
        roomPresences.add(roomId, filteredPresences);
      };
    };
  };

  type HeartbeatState = Map.Map<RoomId, Map.Map<SessionId, Bool>>;
  var heartbeat : HeartbeatState = Map.empty<RoomId, Map.Map<SessionId, Bool>>();

  public shared ({ caller }) func registerHeartbeat(roomId : RoomId, sessionId : SessionId) : async Bool {
    let roomHeartbeat = switch (heartbeat.get(roomId)) {
      case (null) {
        let newRoomHeartbeat = Map.empty<SessionId, Bool>();
        newRoomHeartbeat.add(sessionId, true);
        heartbeat.add(roomId, newRoomHeartbeat);
        newRoomHeartbeat;
      };
      case (?existing) { existing };
    };
    roomHeartbeat.add(sessionId, true);
    true;
  };

  public shared ({ caller }) func unregisterHeartbeat(roomId : RoomId, sessionId : SessionId) : async Bool {
    switch (heartbeat.get(roomId)) {
      case (null) { false };
      case (?roomHeartbeat) {
        roomHeartbeat.remove(sessionId);
        true;
      };
    };
  };

  public shared ({ caller }) func sendHeartbeatSignal() : async () {
    ();
  };

  public shared ({ caller }) func checkAndRemoveFailedHeartbeats(roomId : RoomId, sessionId : SessionId) : async Bool {
    let defaultRoomHeartbeat = Map.empty<Text, Bool>();

    let roomHeartbeat = switch (heartbeat.get(roomId)) {
      case (null) { defaultRoomHeartbeat };
      case (?existing) { existing };
    };

    if (not roomHeartbeat.containsKey(sessionId)) { return false };
    let filteredEntries = roomHeartbeat.toArray().filter(
      func((key, _val)) { key != sessionId }
    );
    let filteredMap = Map.empty<Text, Bool>();
    for ((key, val) in filteredEntries.values()) {
      filteredMap.add(key, val);
    };

    heartbeat.add(roomId, filteredMap);
    true;
  };
};
