import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, KeyboardAvoidingView, Linking,
  PanResponder, Platform, Pressable, ScrollView, FlatList, StyleSheet, Text,
  TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import {
  CATEGORY_KEY, DEFAULT_CATEGORIES, PALETTE, RANDOM_KEY, SOURCE_KEY,
  STORE_KEY, THEME, type Category, type CategoryId, type Decision,
} from './src/model';
import {
  canDeleteCategory, countDecisions, isAppAlbum, reclassifyDecision,
  removeDecision, shufflePhotos, suggestSourceIds, upsertDecision, visiblePhotos,
} from './src/logic';
import {
  deleteFromDevice, getLibraryAccess, getPhotoPage, listPhoneAlbums,
  requestLibraryAccess, syncToPhoneAlbums, type PhoneAlbum, type Photo,
} from './src/media';
import { fitPhotoAtTop, formatPhotoMonth } from './src/swipe-layout';
import { pinchDistance, pinchScale } from './src/pinch';

type Screen = 'swipe' | 'albums' | 'trash';
type Permission = 'checking' | 'granted' | 'denied';

function Tap({ children, onPress, style, disabled }: {
  children: React.ReactNode; onPress: () => void; style?: any; disabled?: boolean;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress}
      style={({ pressed }) => [style, disabled && { opacity: .42 }, pressed && !disabled && { opacity: .76 }]}>
      {children}
    </Pressable>
  );
}

// Two overlapping photo frames and a diagonal cue. Vector mark, no emoji assets.
function BrandMark() {
  return <View style={styles.brandMark}>
    <View style={styles.brandBackFrame} />
    <View style={styles.brandFrontFrame}>
      <View style={styles.brandDot} />
      <View style={styles.brandSlash} />
    </View>
  </View>;
}

function AppScreen() {
  const { width } = useWindowDimensions();
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [screen, setScreen] = useState<Screen>('swipe');
  const [permission, setPermission] = useState<Permission>('checking');
  const [ready, setReady] = useState(false);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [sourceConfigured, setSourceConfigured] = useState(false);
  const [phoneAlbums, setPhoneAlbums] = useState<PhoneAlbum[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [randomMode, setRandomMode] = useState(false);
  const [randomNonce, setRandomNonce] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [draftSourceIds, setDraftSourceIds] = useState<string[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('✨');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reclassifyId, setReclassifyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const position = useRef(new Animated.ValueXY()).current;
  const zoom = useRef(new Animated.Value(1)).current;
  const pinching = useRef(false);
  const pinchStart = useRef(0);
  const scanGeneration = useRef(0);
  const lastActions = useRef<string[]>([]);
  const stats = useMemo(() => countDecisions(decisions), [decisions]);
  const orderedPhotos = useMemo(() => randomMode ? shufflePhotos(photos) : photos,
    [photos, randomMode, randomNonce]);
  const remaining = useMemo(() => visiblePhotos(orderedPhotos, decisions), [orderedPhotos, decisions]);
  const current = remaining[0];
  useEffect(() => { zoom.setValue(1); pinchStart.current = 0; pinching.current = false; }, [current?.id, zoom]);
  const unsynced = decisions.filter(d => d.action === 'keep' && !d.synced).length;
  const reviewTrash = useMemo(() => decisions.filter(d => d.action === 'trash').sort((a, b) => b.timestamp - a.timestamp), [decisions]);
  const availableAlbums = phoneAlbums.filter(a => !isAppAlbum(a.title));
  const sourceNames = [...new Set(availableAlbums.filter(a => sourceIds.includes(a.id)).map(a => a.title))];

  // Do not change STORE_KEY: V1 history must survive a V1.1 update.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet([STORE_KEY, CATEGORY_KEY, SOURCE_KEY, RANDOM_KEY]);
        if (!alive) return;
        const values = Object.fromEntries(entries);
        if (values[STORE_KEY]) {
          const saved = JSON.parse(values[STORE_KEY]!);
          if (Array.isArray(saved)) setDecisions(saved.filter(d =>
            d && typeof d.id === 'string' && ['keep', 'trash', 'deleted'].includes(d.action)));
        }
        if (values[CATEGORY_KEY]) {
          const saved = JSON.parse(values[CATEGORY_KEY]!);
          if (Array.isArray(saved) && saved.length && saved.every(c => c && typeof c.id === 'string' && typeof c.label === 'string')) {
            setCategories(saved);
          }
        }
        if (values[SOURCE_KEY] !== null && values[SOURCE_KEY] !== undefined) {
          const saved = JSON.parse(values[SOURCE_KEY]!);
          if (Array.isArray(saved)) { setSourceIds(saved.filter(id => typeof id === 'string')); setSourceConfigured(true); }
        }
        if (values[RANDOM_KEY] === 'true') setRandomMode(true);
      } catch {
        if (alive) setErrorMessage('Lecture des préférences impossible. La progression existante est préservée.');
      } finally {
        if (alive) setReady(true);
      }
      try {
        const p = await getLibraryAccess();
        if (alive) setPermission(p.granted ? 'granted' : 'denied');
      } catch { if (alive) setPermission('denied'); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(STORE_KEY, JSON.stringify(decisions)).catch(() => setErrorMessage('Sauvegarde des décisions impossible.'));
  }, [decisions, ready]);
  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(CATEGORY_KEY, JSON.stringify(categories)).catch(() => setErrorMessage('Sauvegarde des catégories impossible.'));
  }, [categories, ready]);
  useEffect(() => {
    if (!ready || !sourceConfigured) return;
    void AsyncStorage.setItem(SOURCE_KEY, JSON.stringify(sourceIds)).catch(() => setErrorMessage('Sauvegarde des sources impossible.'));
  }, [sourceIds, ready, sourceConfigured]);
  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(RANDOM_KEY, String(randomMode)).catch(() => {});
  }, [randomMode, ready]);

  // Re-read album names after a sync: photos moved to SwipeSort albums must never appear as sources.
  useEffect(() => {
    if (!ready || permission !== 'granted') return;
    let alive = true;
    (async () => {
      try {
        const found = await listPhoneAlbums();
        if (!alive) return;
        setPhoneAlbums(found);
        if (!sourceConfigured) {
          setSourceIds(suggestSourceIds(found));
          setSourceConfigured(true);
        }
      } catch (error) {
        if (alive) setErrorMessage('Impossible de lire la liste des albums : ' + String(error));
      }
    })();
    return () => { alive = false; };
  }, [permission, ready, refreshTick]);

  // Only read explicitly selected source albums; a virtual "Recents" roll mixes already sorted photos.
  useEffect(() => {
    const token = ++scanGeneration.current;
    if (!ready || permission !== 'granted' || !sourceConfigured || phoneAlbums.length === 0) return;
    const permitted = phoneAlbums.filter(a => sourceIds.includes(a.id) && !isAppAlbum(a.title));
    setPhotos([]);
    if (!permitted.length) { setScanning(false); setScanStatus(''); return; }
    setScanning(true);
    setErrorMessage('');
    void (async () => {
      const found = new Map<string, Photo>();
      try {
        for (let i = 0; i < permitted.length; i++) {
          const album = permitted[i];
          let after: string | undefined;
          let more = true;
          let pages = 0;
          while (more) {
            const page = await getPhotoPage(album.id, after);
            if (token !== scanGeneration.current) return;
            page.assets.forEach(p => found.set(p.id, p));
            pages++;
            setScanStatus(`${album.title} · ${found.size} photo(s) analysée(s)`);
            more = page.hasNextPage && page.assets.length > 0 && after !== page.endCursor;
            after = page.endCursor;
            // Defensive guard against a broken/missing MediaLibrary cursor.
            if (pages > 5000) throw new Error('Trop de pages à charger : sélectionne moins d’albums.');
          }
        }
        if (token !== scanGeneration.current) return;
        setPhotos([...found.values()].sort((a, b) => b.creationTime - a.creationTime));
        setRandomNonce(n => n + 1);
      } catch (error) {
        if (token === scanGeneration.current) setErrorMessage('Chargement incomplet : ' + String(error));
      } finally {
        if (token === scanGeneration.current) { setScanning(false); setScanStatus(''); }
      }
    })();
    return () => { scanGeneration.current++; };
  }, [permission, ready, sourceConfigured, phoneAlbums, sourceIds, refreshTick]);

  const authorize = async () => {
    setPermission('checking');
    try {
      const result = await requestLibraryAccess();
      setPermission(result.granted ? 'granted' : 'denied');
      if (!result.granted) Alert.alert('Autorisation', 'Autorise toutes les photos dans les réglages Android pour trier la galerie.');
    } catch (e) { setPermission('denied'); Alert.alert('Erreur', String(e)); }
  };
  const resetDrag = () => Animated.spring(position, {
    toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7,
  }).start();
  const recordAction = (photo: Photo, action: 'keep' | 'trash', category: CategoryId | null = null) => {
    setDecisions(all => upsertDecision(all, {
      id: photo.id, uri: photo.uri, filename: photo.filename,
      action, category, synced: false, timestamp: Date.now(),
    }));
    lastActions.current.push(photo.id);
  };
  const moveCard = (photo: Photo, action: 'keep' | 'trash', category: CategoryId | null = null) => {
    if (busy || scanning) return;
    setBusy(true);
    setCategoryOpen(false);
    Animated.timing(position, {
      toValue: { x: action === 'keep' ? width + 110 : -width - 110, y: 8 },
      duration: 180, useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      recordAction(photo, action, category);
      setBusy(false);
    });
  };
  const openCategory = () => { if (current && !busy && !scanning) { resetDrag(); setCategoryOpen(true); } };
  const undo = () => {
    if (busy || syncing || deleting) return;
    const id = lastActions.current.pop();
    if (!id || decisions.find(d => d.id === id)?.action === 'deleted') return;
    setCategoryOpen(false);
    setDecisions(all => removeDecision(all, id));
  };
  // Important: pinch takes precedence over left/right swipe. A two-finger gesture
  // never saves a decision, even if one finger is lifted before the other.
  const finishGesture = () => {
    pinching.current = false;
    pinchStart.current = 0;
    Animated.spring(zoom, { toValue: 1, useNativeDriver: false, friction: 9, tension: 105 }).start();
    resetDrag();
  };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: event => event.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: (event, gesture) =>
      screen === 'swipe' && !!current && !busy && !scanning && !categoryOpen && !sourcesOpen &&
      (event.nativeEvent.touches.length >= 2 ||
        (Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy))),
    onPanResponderGrant: event => {
      const touches = event.nativeEvent.touches;
      if (touches.length >= 2) {
        pinching.current = true;
        pinchStart.current = pinchDistance(touches);
        position.setValue({ x: 0, y: 0 });
      }
    },
    onPanResponderMove: (event, gesture) => {
      const touches = event.nativeEvent.touches;
      if (touches.length >= 2) {
        if (!pinching.current) {
          pinching.current = true;
          pinchStart.current = pinchDistance(touches);
          position.setValue({ x: 0, y: 0 });
        }
        zoom.setValue(pinchScale(pinchDistance(touches), pinchStart.current));
        return;
      }
      // Do not activate swipe again after a pinch until *all* fingers are released.
      if (pinching.current) return;
      position.setValue({ x: gesture.dx, y: gesture.dy * .10 });
    },
    onPanResponderRelease: (_event, gesture) => {
      if (pinching.current) return finishGesture();
      if (!current || busy) return resetDrag();
      if (gesture.dx < -95) moveCard(current, 'trash');
      else if (gesture.dx > 95) openCategory();
      else resetDrag();
    },
    onPanResponderTerminate: finishGesture,
  }), [current?.id, busy, scanning, categoryOpen, sourcesOpen, screen, width]);

  const openSources = () => { setDraftSourceIds([...sourceIds]); setSourcesOpen(true); };
  const toggleSource = (id: string) => {
    setDraftSourceIds(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  };
  const saveSources = () => { setSourceIds(draftSourceIds); setSourcesOpen(false); };
  const beginEdit = (cat?: Category) => {
    setEditingId(cat?.id || null);
    setEditName(cat?.label || '');
    setEditEmoji(cat?.emoji || '✨');
    setCategoryEditor(true);
  };
  const saveCategory = () => {
    const label = editName.trim().slice(0, 30);
    if (!label) return Alert.alert('Nom manquant', 'Entre un nom pour cette catégorie.');
    if (categories.some(c => c.id !== editingId && c.label.trim().toLowerCase() === label.toLowerCase())) {
      return Alert.alert('Nom déjà utilisé', 'Choisis un autre nom de catégorie.');
    }
    if (editingId) {
      const old = categories.find(c => c.id === editingId);
      setCategories(all => all.map(c => c.id === editingId ? { ...c, label, emoji: editEmoji.trim() || '✨' } : c));
      if (old?.albumTitle && old.label !== label) {
        Alert.alert('Catégorie renommée', `Le nom est changé dans SwipeSort. Pour renommer l’album physique « ${old.albumTitle} », fais-le dans la galerie Samsung : SwipeSort ne renomme pas les albums existants.`);
      }
    } else {
      setCategories(all => [...all, {
        id: `personnalise_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label, emoji: editEmoji.trim() || '✨', color: PALETTE[categories.length % PALETTE.length],
      }]);
    }
    setCategoryEditor(false);
  };
  const deleteCategory = (cat: Category) => {
    if (!canDeleteCategory(cat, categories, decisions)) {
      return Alert.alert('Catégorie utilisée', 'Pour la retirer, reclasse d’abord toutes ses photos dans une autre catégorie. Aucun album Samsung ne sera supprimé.');
    }
    Alert.alert('Retirer cette catégorie ?', `« ${cat.label} » sera retirée de SwipeSort. L'album Samsung éventuel restera intact.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => setCategories(all => all.filter(c => c.id !== cat.id)) },
    ]);
  };
  const applyReclassification = (id: string, categoryId: string) => {
    setDecisions(all => reclassifyDecision(all, id, categoryId));
    setReclassifyId(null);
    Alert.alert('Photo reclassée', 'Le nouveau choix est enregistré. Si la photo était déjà synchronisée, une nouvelle synchronisation sera nécessaire pour la déplacer dans la galerie.');
  };
  const restoreFromTrash = (id: string) => {
    lastActions.current = lastActions.current.filter(x => x !== id);
    setDecisions(all => removeDecision(all, id));
  };
  const runDelete = () => {
    if (!reviewTrash.length || deleting || syncing) return;
    Alert.alert(`Supprimer ${reviewTrash.length} photo(s) ?`,
      'Les originaux seront supprimés du téléphone après confirmation Android. Teste d’abord avec quelques photos sauvegardées.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer les originaux', style: 'destructive', onPress: async () => {
          setDeleting(true);
          let done = 0;
          try {
            for (let i = 0; i < reviewTrash.length; i += 30) {
              const batch = reviewTrash.slice(i, i + 30);
              const ok = await deleteFromDevice(batch.map(d => d.id));
              if (!ok) break;
              done += batch.length;
              const ids = new Set(batch.map(d => d.id));
              setDecisions(all => all.map(d => ids.has(d.id) ? { ...d, action: 'deleted' as const } : d));
            }
            Alert.alert('Corbeille', `${done} photo(s) supprimée(s). ${reviewTrash.length - done} restante(s).`);
            if (done) setRefreshTick(n => n + 1);
          } catch (e) { Alert.alert('Suppression interrompue', String(e)); }
          finally { setDeleting(false); }
        } },
      ]);
  };
  const runSync = () => {
    if (!unsynced || syncing || deleting) return;
    Alert.alert('Synchroniser avec Samsung ?',
      `Déplacer ${unsynced} photo(s) vers tes albums « SwipeSort - ... » ? Android peut demander une confirmation par groupe de photos. Les autres albums ne sont pas parcourus.`, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Synchroniser', onPress: async () => {
          setSyncing(true);
          try {
            const result = await syncToPhoneAlbums(decisions, categories,
              ids => {
                const completed = new Set(ids);
                setDecisions(all => all.map(d => completed.has(d.id) ? { ...d, synced: true } : d));
                lastActions.current = lastActions.current.filter(id => !completed.has(id));
                const categoryId = decisions.find(d => d.id === ids[0])?.category;
                if (categoryId) setCategories(all => all.map(c => c.id === categoryId && !c.albumTitle
                  ? { ...c, albumTitle: `SwipeSort - ${c.label}` } : c));
              }, setSyncMessage);
            Alert.alert('Synchronisation', `${result.processed} photo(s) rangée(s).` +
              (result.canceled ? '\nAutorisation interrompue : les autres restent en attente.' : '') +
              (result.errors.length ? `\n${result.errors.length} lot(s) non traité(s). ${result.errors[0]}` : ''));
          } catch (e) { Alert.alert('Synchronisation interrompue', String(e)); }
          finally { setSyncMessage(''); setSyncing(false); setRefreshTick(n => n + 1); }
        } },
      ]);
  };

  const rotate = position.x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-10deg', '0deg', '10deg'], extrapolate: 'clamp' });
  const deleteOpacity = position.x.interpolate({ inputRange: [-110, -25, 0], outputRange: [1, 0, 0], extrapolate: 'clamp' });
  const keepOpacity = position.x.interpolate({ inputRange: [0, 25, 110], outputRange: [0, 0, 1], extrapolate: 'clamp' });
  const photoBounds = useMemo(() => fitPhotoAtTop(stageSize.width, stageSize.height, current?.width, current?.height),
    [stageSize, current?.id, current?.width, current?.height]);
  const feedbackScale = position.x.interpolate({ inputRange: [-130, 0, 130], outputRange: [1.13, .86, 1.13], extrapolate: 'clamp' });
  const dateText = formatPhotoMonth(current?.creationTime);
  const currentDetail = categories.find(c => c.id === detailId);
  const detailPhotos = decisions.filter(d => d.action === 'keep' && d.category === detailId)
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <SafeAreaView style={styles.safe} edges={['top','bottom']}>
      <StatusBar style="light" />
      {!!errorMessage && <Tap onPress={() => { setErrorMessage(''); setRefreshTick(x => x + 1); }} style={styles.warning}>
        <Text style={{ color: THEME.red, fontSize: 12 }}>{errorMessage} · Réessayer</Text>
      </Tap>}
      {!ready || permission === 'checking' ? (
        <View style={styles.center}><ActivityIndicator color={THEME.violet} size="large"/><Text style={styles.muted}>Ouverture de la galerie…</Text></View>
      ) : permission === 'denied' ? (
        <View style={[styles.center, { paddingHorizontal: 28 }]}>
          <Text style={{ fontSize: 66 }}>🖼️</Text>
          <Text style={styles.hero}>Ta galerie, à ton rythme.</Text>
          <Text style={[styles.muted, { textAlign: 'center', lineHeight: 21 }]}>Aucune photo n’est envoyée sur Internet. Autorise l’accès complet aux photos pour les trier.</Text>
          <Tap onPress={authorize} style={styles.primary}><Text style={styles.primaryText}>Autoriser mes photos</Text></Tap>
          <Tap onPress={() => void Linking.openSettings()} style={{ padding: 20 }}><Text style={styles.link}>Réglages du téléphone</Text></Tap>
        </View>
      ) : (
        <>
          {screen === 'swipe' ? (
            <View style={styles.swipePage}>
              <View style={styles.brandHeader}>
                <View style={styles.brandIdentity}>
                  <BrandMark />
                  <Text style={styles.brandTitle}>Swipe<Text style={styles.brandTitleAccent}>Sort</Text></Text>
                </View>
                <View style={styles.brandControls}>
                  <Text style={styles.brandCounter}>{stats.reviewed} triées</Text>
                  <Tap onPress={() => { setRandomMode(m => !m); setRandomNonce(n => n + 1); }}
                    style={[styles.headerIconButton, randomMode && styles.randomActive]}>
                    <Text style={[styles.randomIconText, randomMode && { color: '#191329' }]}>⤨</Text>
                  </Tap>
                </View>
              </View>
              <View
                style={styles.photoStage}
                onLayout={event => {
                  const { width: w, height: h } = event.nativeEvent.layout;
                  if (Math.abs(w - stageSize.width) > 1 || Math.abs(h - stageSize.height) > 1) {
                    setStageSize({ width: w, height: h });
                  }
                }}>
                {scanning ? (
                  <View style={styles.emptyCard}>
                    <ActivityIndicator color={THEME.violet} size="large" />
                    <Text style={styles.emptyTitle}>Préparation de ta sélection</Text>
                    <Text style={styles.muted}>{scanStatus || 'Lecture des albums autorisés…'}</Text>
                  </View>
                ) : !current ? (
                  <View style={styles.emptyCard}>
                    <Text style={{ fontSize: 53 }}>{sourceNames.length ? '🎉' : '🗂️'}</Text>
                    <Text style={styles.emptyTitle}>{sourceNames.length ? 'Tout est trié !' : 'Choisis tes albums sources'}</Text>
                    <Text style={[styles.muted, { textAlign: 'center', lineHeight: 21 }]}>{sourceNames.length
                      ? 'Aucune nouvelle photo dans cette sélection. Les anciennes décisions sont conservées.'
                      : 'On ne touche pas à tes albums déjà organisés. Sélectionne seulement les dossiers à trier.'}</Text>
                    <Tap onPress={openSources} style={styles.secondary}><Text style={styles.link}>Choisir les sources</Text></Tap>
                    <Tap onPress={() => setRefreshTick(n => n + 1)} style={{ padding: 12 }}><Text style={styles.muted}>↻ Actualiser</Text></Tap>
                  </View>
                ) : (
                  <>
                    <Animated.View pointerEvents="none" style={[styles.swipeTint, { backgroundColor: '#521C32', opacity: deleteOpacity }]} />
                    <Animated.View pointerEvents="none" style={[styles.swipeTint, { backgroundColor: '#164E3B', opacity: keepOpacity }]} />
                    <Animated.View {...pan.panHandlers} style={[styles.photoCard, { transform: [
                      { translateX: position.x }, { translateY: position.y }, { rotate },
                    ]}]}>
                      <Animated.View style={[styles.photoFrame, photoBounds, { transform: [{ scale: zoom }] }]}>
                        <Image source={{ uri: current.uri }} style={styles.stageImage} resizeMode="contain" />
                      </Animated.View>
                    </Animated.View>
                    <Animated.View pointerEvents="none" style={[styles.gestureIndicator, { opacity: deleteOpacity, transform: [{ scale: feedbackScale }] }]}>
                      <Text style={[styles.gestureSymbol, { color: THEME.red }]}>×</Text>
                      <Text style={[styles.gestureLabel, { color: THEME.red }]}>SUPPRIMER</Text>
                    </Animated.View>
                    <Animated.View pointerEvents="none" style={[styles.gestureIndicator, { opacity: keepOpacity, transform: [{ scale: feedbackScale }] }]}>
                      <Text style={[styles.gestureSymbol, { color: THEME.green }]}>✓</Text>
                      <Text style={[styles.gestureLabel, { color: THEME.green }]}>GARDER</Text>
                    </Animated.View>
                  </>
                )}
                <View style={styles.stageHeader} pointerEvents="box-none">
                  <Tap onPress={openSources} style={styles.sourceButton}>
                    <Text style={styles.smallTop} numberOfLines={1}>▤  {sourceNames.length ? sourceNames.join(' + ') : 'Sources'}  ▾</Text>
                  </Tap>
                  {!!dateText && <View style={styles.stageDate}><Text style={styles.dateText}>{dateText}</Text></View>}
                </View>
                <View style={styles.bottomUndoRow} pointerEvents="box-none">
                  <Tap onPress={undo} disabled={!lastActions.current.length || busy} style={[styles.floatingUndoButton, (!lastActions.current.length || busy) && styles.floatingUndoDisabled]}>
                    <Text style={styles.floatingUndoText}>↶ Annuler</Text>
                  </Tap>
                </View>
              </View>
            </View>
          ) : screen === 'albums' ? (
            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.kicker}>TON ESPACE ✦</Text><Text style={styles.pageTitle}>Tes souvenirs.</Text>
              <Text style={styles.muted}>Personnalise tes catégories et retrouve les photos déjà triées.</Text>
              <View style={styles.metrics}>
                <View style={styles.metric}><Text style={styles.metricNumber}>{stats.kept}</Text><Text style={styles.muted}>Conservées</Text></View>
                <View style={styles.metric}><Text style={styles.metricNumber}>{stats.deleted}</Text><Text style={styles.muted}>Supprimées</Text></View>
              </View>
              <View style={styles.headingRow}>
                <Text style={styles.heading}>MES CATÉGORIES</Text>
                <Tap onPress={() => beginEdit()} style={styles.linkButton}><Text style={styles.link}>＋ Ajouter</Text></Tap>
              </View>
              {categories.map(cat => {
                const count = decisions.filter(d => d.action === 'keep' && d.category === cat.id).length;
                return (
                  <View key={cat.id} style={styles.albumRow}>
                    <Tap onPress={() => setDetailId(cat.id)} style={styles.albumTap}>
                      <View style={[styles.albumIcon, { backgroundColor: cat.color + '27' }]}><Text style={{ fontSize: 26 }}>{cat.emoji}</Text></View>
                      <View style={{ flex: 1 }}><Text style={styles.albumName}>{cat.label}</Text><Text style={styles.albumMeta}>{count} photo(s) · Voir / reclasser</Text></View>
                    </Tap>
                    <Tap onPress={() => beginEdit(cat)} style={styles.editButton}><Text style={styles.link}>✎</Text></Tap>
                    <Tap onPress={() => deleteCategory(cat)} style={styles.editButton}><Text style={{ color: THEME.red }}>×</Text></Tap>
                  </View>
                );
              })}
              <View style={styles.syncBox}>
                <Text style={styles.syncTitle}>Albums Samsung</Text>
                <Text style={styles.syncSub}>{unsynced ? `${unsynced} photo(s) à synchroniser` : 'Toutes les décisions de conservation sont synchronisées.'}</Text>
                <Tap onPress={runSync} disabled={syncing || deleting || !unsynced} style={styles.primary}>
                  {syncing ? <ActivityIndicator color="#171223" /> : <Text style={styles.primaryText}>{unsynced ? 'Ranger les photos par lots' : '✓ Synchronisé'}</Text>}
                </Tap>
                {!!syncMessage && <Text style={styles.syncSub}>{syncMessage}</Text>}
                <Text style={styles.finePrint}>Regroupement par lots jusqu’à 120 photos. Android peut toujours demander de confirmer chaque lot. Les albums Samsung existants ne sont pas renommés automatiquement.</Text>
              </View>
              <Tap onPress={openSources} style={styles.secondary}><Text style={styles.link}>⚙ Choisir les dossiers sources à trier</Text></Tap>
            </ScrollView>
          ) : (
            <View style={styles.trashPage}>
              <Text style={styles.kicker}>AVANT DE SUPPRIMER ✦</Text><Text style={styles.pageTitle}>La corbeille.</Text>
              <Text style={[styles.muted, { lineHeight: 19, marginTop: 7 }]}>Une photo swipée à gauche reste sur ton téléphone jusqu'à ta confirmation.</Text>
              <Text style={styles.trashCount}>{reviewTrash.length} photo(s) en attente</Text>
              <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 12 }} style={{ flex: 1 }}>
                {!reviewTrash.length && <Text style={[styles.muted, { textAlign: 'center', marginTop: 45 }]}>La corbeille est vide 🫧</Text>}
                {reviewTrash.map(d => <View key={d.id} style={styles.trashItem}>
                  <Image source={{ uri: d.uri }} style={styles.trashThumb} />
                  <Text style={[styles.albumName, { flex: 1 }]} numberOfLines={1}>{d.filename}</Text>
                  <Tap onPress={() => restoreFromTrash(d.id)} style={styles.editButton}><Text style={styles.link}>Annuler</Text></Tap>
                </View>)}
              </ScrollView>
              <Tap onPress={runDelete} disabled={deleting || syncing || !reviewTrash.length} style={styles.deleteAll}>
                {deleting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.deleteAllText}>🗑 Supprimer {reviewTrash.length} photo(s)</Text>}
              </Tap>
            </View>
          )}
          <View style={styles.nav}>
            {([['swipe','▣','Trier'],['albums','▤','Albums'],['trash','⌫','Corbeille']] as const).map(([id, icon, title]) => (
              <Tap key={id} onPress={() => { setCategoryOpen(false); setScreen(id); }} style={[styles.navItem, screen === id && styles.navActive]}>
                <Text style={[styles.navLabel, screen === id && { color: THEME.white }]}>{icon}  {title}</Text>
                {id === 'trash' && stats.pending > 0 && <View style={styles.dot} />}
              </Tap>
            ))}
          </View>
        </>
      )}

      {sourcesOpen && <View style={styles.scrim}>
        <Tap onPress={() => setSourcesOpen(false)} style={StyleSheet.absoluteFillObject}/>
        <View style={[styles.sheet, { maxHeight: '87%' }]}>
          <View style={styles.handle}/><Text style={styles.sheetTitle}>Photos à trier</Text>
          <Text style={styles.sheetSub}>Sélectionne uniquement les albums non organisés (par exemple Caméra). Les autres ne seront pas touchés. « Récents » sur Samsung mélange parfois tous les albums.</Text>
          <ScrollView style={{ maxHeight: 390 }}>
            {availableAlbums.length === 0 && <Text style={styles.muted}>Aucun album trouvé. Vérifie l’accès à toutes les photos.</Text>}
            {availableAlbums.map(album => (
              <Tap key={album.id} onPress={() => toggleSource(album.id)} style={styles.sourceRow}>
                <Text style={[styles.checkBox, draftSourceIds.includes(album.id) && styles.checkOn]}>{draftSourceIds.includes(album.id) ? '✓' : ''}</Text>
                <Text style={[styles.albumName, { flex: 1 }]}>{album.title}</Text>
                <Text style={styles.albumMeta}>{album.assetCount || 0}</Text>
              </Tap>
            ))}
          </ScrollView>
          <Text style={styles.finePrint}>Les albums « SwipeSort - ... » sont toujours exclus, même si tu as déjà synchronisé tes photos.</Text>
          <Tap onPress={saveSources} style={styles.primary}><Text style={styles.primaryText}>Trier ces {draftSourceIds.length} album(s)</Text></Tap>
        </View>
      </View>}

      {categoryOpen && current && <View style={styles.scrim}>
        <Tap onPress={() => setCategoryOpen(false)} style={StyleSheet.absoluteFillObject}/>
        <View style={styles.sheet}>
          <View style={styles.handle}/><Text style={styles.sheetTitle}>On la garde où ? ♥</Text>
          <Text style={styles.sheetSub}>Choisis une catégorie pour cette photo.</Text>
          <ScrollView style={{ maxHeight: 370 }} contentContainerStyle={styles.categoryGrid}>
            {categories.map(cat => <Tap key={cat.id} onPress={() => moveCard(current, 'keep', cat.id)} style={[styles.categoryTile, { borderColor: cat.color + '66' }]}>
              <Text style={{ fontSize: 28 }}>{cat.emoji}</Text><Text style={styles.tileLabel}>{cat.label}</Text>
            </Tap>)}
            <Tap onPress={() => { setCategoryOpen(false); beginEdit(); }} style={styles.categoryTile}><Text style={{ fontSize: 28 }}>＋</Text><Text style={styles.tileLabel}>Créer</Text></Tap>
          </ScrollView>
          <Tap onPress={() => setCategoryOpen(false)} style={{ padding: 13 }}><Text style={[styles.link, { textAlign: 'center' }]}>Retour</Text></Tap>
        </View>
      </View>}

      {categoryEditor && <View style={styles.scrim}>
        <Tap onPress={() => setCategoryEditor(false)} style={StyleSheet.absoluteFillObject}/>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={styles.sheet}>
            <View style={styles.handle}/><Text style={styles.sheetTitle}>{editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</Text>
            <Text style={styles.sheetSub}>Personnalise le nom et l’emoji. Aucune photo ne sera supprimée.</Text>
            <Text style={styles.inputLabel}>Nom</Text>
            <TextInput value={editName} onChangeText={setEditName} placeholder="Ex. Animaux, Sport…" placeholderTextColor={THEME.muted} style={styles.textInput} maxLength={30} autoFocus />
            <Text style={styles.inputLabel}>Emoji</Text>
            <TextInput value={editEmoji} onChangeText={setEditEmoji} placeholder="✨" placeholderTextColor={THEME.muted} style={[styles.textInput, { width: 90 }]} maxLength={8} />
            <Tap onPress={saveCategory} style={styles.primary}><Text style={styles.primaryText}>Enregistrer</Text></Tap>
            <Tap onPress={() => setCategoryEditor(false)} style={{ padding: 11 }}><Text style={[styles.link, { textAlign: 'center' }]}>Annuler</Text></Tap>
          </View>
        </KeyboardAvoidingView>
      </View>}

      {detailId && currentDetail && <View style={styles.scrim}>
        <Tap onPress={() => setDetailId(null)} style={StyleSheet.absoluteFillObject}/>
        <View style={[styles.sheet, { maxHeight: '84%' }]}>
          <View style={styles.handle}/><Text style={styles.sheetTitle}>{currentDetail.emoji} {currentDetail.label}</Text>
          <Text style={styles.sheetSub}>{detailPhotos.length} photo(s) · Appuie sur une photo pour la reclasser.</Text>
          <FlatList style={{ maxHeight: 390 }} contentContainerStyle={{ paddingBottom: 10 }}
            data={detailPhotos} keyExtractor={item => item.id} numColumns={3}
            columnWrapperStyle={{ gap: 7, marginBottom: 7 }}
            renderItem={({ item }) => <Tap onPress={() => { setReclassifyId(item.id); setDetailId(null); }} style={styles.thumbTile}>
              <Image source={{ uri: item.uri }} style={styles.thumbImage}/>
            </Tap>}/>
          <Tap onPress={() => setDetailId(null)} style={styles.primary}><Text style={styles.primaryText}>Fermer</Text></Tap>
        </View>
      </View>}

      {!!reclassifyId && <View style={styles.scrim}>
        <Tap onPress={() => setReclassifyId(null)} style={StyleSheet.absoluteFillObject}/>
        <View style={styles.sheet}>
          <View style={styles.handle}/><Text style={styles.sheetTitle}>Changer la catégorie</Text>
          <Text style={styles.sheetSub}>Ta photo reste conservée et ne retourne pas dans la pile.</Text>
          <ScrollView style={{ maxHeight: 370 }} contentContainerStyle={styles.categoryGrid}>
            {categories.map(cat => <Tap key={cat.id} onPress={() => applyReclassification(reclassifyId, cat.id)} style={[styles.categoryTile, { borderColor: cat.color + '66' }]}>
              <Text style={{ fontSize: 28 }}>{cat.emoji}</Text><Text style={styles.tileLabel}>{cat.label}</Text>
            </Tap>)}
          </ScrollView>
          <Tap onPress={() => setReclassifyId(null)} style={{ padding: 11 }}><Text style={[styles.link, { textAlign: 'center' }]}>Annuler</Text></Tap>
        </View>
      </View>}
    </SafeAreaView>
  );
}

export default function App() { return <SafeAreaProvider><AppScreen/></SafeAreaProvider>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },
  warning: { backgroundColor: '#462435', paddingHorizontal: 14, paddingVertical: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  hero: { fontSize: 29, fontWeight: '900', color: THEME.white, textAlign: 'center' },
  muted: { fontSize: 12, color: THEME.muted, marginTop: 6 },
  link: { color: THEME.violet, fontWeight: '800', fontSize: 12 },
  primary: { marginTop: 13, backgroundColor: THEME.violet, borderRadius: 16, padding: 15, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#15111E', fontWeight: '900', fontSize: 14 },
  secondary: { marginTop: 18, borderRadius: 12, borderWidth: 1, borderColor: THEME.violet, padding: 13, alignItems: 'center' },
  // Quiet violet brand header leaves a stage in which each photo is centred without cropping.
  brandHeader: { height: 59, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', backgroundColor: '#21182E', borderBottomColor: '#4D3A623D', borderBottomWidth: 1 },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', letterSpacing: -.5 },
  brandTitleAccent: { color: '#C3A8FF' },
  brandControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandCounter: { color: '#D8CBE7', fontSize: 11, fontWeight: '700' },
  brandMark: { height: 32, width: 37, justifyContent: 'center', alignItems: 'center' },
  brandBackFrame: { position: 'absolute', top: 6, left: 2, width: 26, height: 23,
    borderRadius: 6, borderWidth: 1.8, borderColor: '#8A6BC2', transform: [{ rotate: '-13deg' }] },
  brandFrontFrame: { position: 'absolute', top: 3, right: 2, width: 27, height: 24, borderRadius: 6,
    borderWidth: 1.8, borderColor: '#D4BCFF', backgroundColor: '#322048', overflow: 'hidden' },
  brandDot: { position: 'absolute', top: 4, right: 5, width: 5, height: 5, borderRadius: 5, backgroundColor: '#BFA0FF' },
  brandSlash: { position: 'absolute', left: 1, top: 16, width: 29, height: 2, backgroundColor: '#CDB2FF', transform: [{ rotate: '-35deg' }] },
  // No photo cropped: we centre the full-size fitted image in a violet stage.
  swipePage: { flex: 1, paddingHorizontal: 0, backgroundColor: '#1B1429' },
  photoStage: { flex: 1, minHeight: 150, overflow: 'hidden', backgroundColor: '#1B1429', position: 'relative' },
  photoCard: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#1B1429' },
  cardBelow: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-start', backgroundColor: '#08070D' },
  stageImage: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  photoFrame: { borderRadius: 9, borderColor: '#BDA9E05C', borderWidth: 1, backgroundColor: '#140F20', overflow: 'hidden' },
  stageHeader: { position: 'absolute', top: 7, left: 10, right: 10, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceButton: { flex: 1, maxWidth: '68%', minHeight: 32, justifyContent: 'center', backgroundColor: '#100E18CC',
    paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#39344999' },
  smallTop: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  headerIconButton: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#100E18CC', borderColor: '#39344999', borderWidth: 1 },
  headerIconText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  randomIconText: { color: '#E5D9FF', fontSize: 24, fontWeight: '700' },
  bottomUndoRow: { position: 'absolute', left: 10, bottom: 10, zIndex: 11 },
  floatingUndoButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#100E18E8', borderColor: '#393449CC', borderWidth: 1 },
  floatingUndoDisabled: { opacity: 0.42 },
  floatingUndoText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  randomActive: { backgroundColor: THEME.violet },
  stageDate: { marginLeft: 'auto', alignSelf: 'center', backgroundColor: '#141020C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  dateText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  swipeTint: { ...StyleSheet.absoluteFillObject },
  gestureIndicator: { position: 'absolute', bottom: 88, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center' },
  gestureSymbol: { fontSize: 86, lineHeight: 90, fontWeight: '900', textShadowColor: '#000000', textShadowRadius: 10 },
  gestureLabel: { fontSize: 31, fontWeight: '900', letterSpacing: 1.1,
    textShadowColor: '#000000', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 } },
  emptyCard: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.surface, padding: 20 },
  emptyTitle: { color: THEME.white, fontSize: 20, fontWeight: '900', marginTop: 15, textAlign: 'center' },
  nav: { marginTop: 4, marginBottom: 3, marginHorizontal: 10, borderRadius: 18, backgroundColor: THEME.surface, padding: 5, flexDirection: 'row', borderWidth: 1, borderColor: THEME.border },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14 },
  navActive: { backgroundColor: THEME.surface2 },
  navLabel: { color: THEME.muted, fontSize: 12, fontWeight: '800' },
  dot: { position: 'absolute', top: 2, right: 8, backgroundColor: THEME.red, width: 7, height: 7, borderRadius: 4 },
  scroll: { flex: 1, paddingHorizontal: 18, paddingTop: 18 },
  kicker: { color: THEME.violet, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 9 },
  pageTitle: { color: THEME.white, fontSize: 28, fontWeight: '900' },
  metrics: { flexDirection: 'row', gap: 11, marginTop: 21, marginBottom: 25 },
  metric: { flex: 1, backgroundColor: THEME.surface, padding: 17, borderRadius: 15, borderWidth: 1, borderColor: THEME.border },
  metricNumber: { color: THEME.white, fontSize: 29, fontWeight: '900' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading: { fontSize: 10, letterSpacing: 1.4, fontWeight: '800', color: THEME.muted },
  linkButton: { padding: 6 },
  albumRow: { backgroundColor: THEME.surface, borderRadius: 15, borderWidth: 1, borderColor: THEME.border, flexDirection: 'row', alignItems: 'center', marginBottom: 8, padding: 9 },
  albumTap: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' },
  albumIcon: { width: 45, height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  albumName: { color: THEME.white, fontSize: 13, fontWeight: '800' },
  albumMeta: { color: THEME.muted, fontSize: 10, marginTop: 4 },
  editButton: { padding: 11 },
  syncBox: { backgroundColor: '#2B2440', borderColor: '#54456B', borderWidth: 1, padding: 18, borderRadius: 18, marginTop: 16 },
  syncTitle: { color: THEME.white, fontSize: 16, fontWeight: '900' },
  syncSub: { color: '#D9CFFF', fontSize: 12, marginTop: 8, lineHeight: 18 },
  finePrint: { color: THEME.muted, fontSize: 10, lineHeight: 16, marginTop: 12 },
  trashPage: { flex: 1, padding: 17 },
  trashCount: { color: THEME.red, fontWeight: '900', fontSize: 19, marginTop: 23, marginBottom: 10 },
  trashItem: { borderRadius: 13, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.surface, padding: 8, flexDirection: 'row', gap: 10, alignItems: 'center' },
  trashThumb: { width: 55, height: 55, borderRadius: 10, backgroundColor: THEME.surface2 },
  deleteAll: { backgroundColor: '#D75675', alignItems: 'center', padding: 16, borderRadius: 15 },
  deleteAllText: { color: 'white', fontWeight: '900', fontSize: 14 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000C9', justifyContent: 'flex-end', zIndex: 50 },
  sheet: { paddingHorizontal: 20, paddingTop: 13, paddingBottom: 23, backgroundColor: '#251F34', borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: 1, borderColor: THEME.border },
  handle: { width: 45, height: 5, alignSelf: 'center', backgroundColor: '#575068', borderRadius: 4, marginBottom: 15 },
  sheetTitle: { color: THEME.white, fontWeight: '900', fontSize: 24 },
  sheetSub: { color: THEME.muted, fontSize: 12, lineHeight: 19, marginTop: 9, marginBottom: 15 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderColor: THEME.border },
  checkBox: { width: 25, height: 25, borderRadius: 8, borderWidth: 1, borderColor: THEME.muted, color: '#171223', textAlign: 'center', textAlignVertical: 'center', fontSize: 17, fontWeight: '900', overflow: 'hidden' },
  checkOn: { backgroundColor: THEME.green, borderColor: THEME.green },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryTile: { width: '30%', flexGrow: 1, minWidth: 88, paddingVertical: 14, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, backgroundColor: THEME.surface2, minHeight: 88 },
  tileLabel: { color: THEME.white, marginTop: 8, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  inputLabel: { color: THEME.muted, fontSize: 11, marginBottom: 6, fontWeight: '800' },
  textInput: { color: THEME.white, borderColor: THEME.border, borderWidth: 1, borderRadius: 12, backgroundColor: THEME.surface, fontSize: 16, paddingHorizontal: 15, paddingVertical: 10, marginBottom: 16 },
  thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  thumbTile: { flex: 1, aspectRatio: 1, borderRadius: 9, overflow: 'hidden', backgroundColor: THEME.surface2 },
  thumbImage: { width: '100%', height: '100%' },
});
