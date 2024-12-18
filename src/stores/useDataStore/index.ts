import { isEqual } from 'lodash'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { fetchGraphData } from '~/network/fetchGraphData'
import { FetchDataResponse, FilterParams, Link, Node, NodeExtended, NodeType, Sources, Trending, TStats } from '~/types'
import { useAiSummaryStore } from '../useAiSummaryStore'
import { useAppStore } from '../useAppStore'
import { useUserStore } from '../useUserStore'

export type FetchNodeParams = {
  word?: string
  skip_cache?: string
  free?: string
  media_type?: string
}

export type SidebarFilterWithCount = {
  name: string
  count: number
}

export type DataStore = {
  splashDataLoading: boolean
  abortRequest: boolean
  categoryFilter: NodeType | null
  dataInitial: { nodes: NodeExtended[]; links: Link[] } | null
  dataNew: { nodes: NodeExtended[]; links: Link[] } | null
  filters: FilterParams
  isFetching: boolean
  isLoadingNew: boolean
  selectedTimestamp: NodeExtended | null
  sources: Sources[] | null
  queuedSources: Sources[] | null
  hideNodeDetails: boolean
  sidebarFilter: string
  sidebarFilters: string[]
  sidebarFilterCounts: SidebarFilterWithCount[]
  trendingTopics: Trending[]
  stats: TStats | null
  nodeTypes: string[]
  seedQuestions: string[] | null
  runningProjectId: string
  runningProjectMessages: string[]
  nodesNormalized: Map<string, Node>
  linksNormalized: Map<string, Link>

  setTrendingTopics: (trendingTopics: Trending[]) => void
  resetDataNew: () => void
  setStats: (stats: TStats) => void
  setSidebarFilter: (filter: string) => void
  setCategoryFilter: (categoryFilter: NodeType | null) => void
  fetchData: (
    setBudget: (value: number | null) => void,
    setAbortRequests: (status: boolean) => void,
    AISearchQuery?: string,
    params?: FetchNodeParams,
  ) => void
  setSelectedTimestamp: (selectedTimestamp: NodeExtended | null) => void
  setSources: (sources: Sources[] | null) => void
  setQueuedSources: (sources: Sources[] | null) => void
  setIsFetching: (_: boolean) => void
  setRunningProjectId: (runningProjectId: string) => void
  setRunningProjectMessages: (message: string) => void
  resetRunningProjectMessages: () => void
  setHideNodeDetails: (_: boolean) => void
  addNewNode: (data: FetchDataResponse) => void
  updateNode: (updatedNode: NodeExtended) => void
  removeNode: (id: string) => void
  setSidebarFilterCounts: (filterCounts: SidebarFilterWithCount[]) => void
  setAbortRequests: (abortRequest: boolean) => void
  nextPage: () => void
  setFilters: (filters: Partial<FilterParams>) => void
  setSeedQuestions: (questions: string[]) => void
  abortFetchData: () => void
  resetGraph: () => void
  resetData: () => void
}

const defaultData: Omit<
  DataStore,
  | 'setTrendingTopics'
  | 'setStats'
  | 'setSidebarFilter'
  | 'fetchData'
  | 'setFilters'
  | 'setIsFetching'
  | 'setCategoryFilter'
  | 'setHoveredNode'
  | 'setSelectedTimestamp'
  | 'setSphinxModalOpen'
  | 'setSources'
  | 'setSidebarFilterCounts'
  | 'setQueuedSources'
  | 'setHideNodeDetails'
  | 'addNewNode'
  | 'updateNode'
  | 'removeNode'
  | 'setAbortRequests'
  | 'nextPage'
  | 'resetDataNew'
  | 'setSeedQuestions'
  | 'setRunningProjectId'
  | 'setRunningProjectMessages'
  | 'resetRunningProjectMessages'
  | 'abortFetchData'
  | 'resetGraph'
  | 'resetData'
> = {
  categoryFilter: null,
  dataInitial: null,
  runningProjectMessages: [],
  filters: {
    skip: 0,
    limit: 300,
    depth: '2',
    sort_by: 'score',
    include_properties: 'true',
    top_node_count: '50',
    includeContent: 'true',
    node_type: [],
    search_method: 'vector',
  },
  isFetching: false,
  isLoadingNew: false,
  queuedSources: null,
  selectedTimestamp: null,
  sources: null,
  sidebarFilter: 'all',
  sidebarFilters: [],
  trendingTopics: [],
  sidebarFilterCounts: [],
  stats: null,
  splashDataLoading: true,
  abortRequest: false,
  dataNew: null,
  seedQuestions: null,
  runningProjectId: '',
  hideNodeDetails: false,
  nodeTypes: [],
  nodesNormalized: new Map<string, Node>(),
  linksNormalized: new Map<string, Link>(),
}

let abortController: AbortController | null = null

export const useDataStore = create<DataStore>()(
  devtools((set, get) => ({
    ...defaultData,

    fetchData: async (setBudget, setAbortRequests, AISearchQuery = '') => {
      const { filters, addNewNode } = get()
      const currentPage = filters.skip
      const itemsPerPage = filters.limit
      const { currentSearch } = useAppStore.getState()
      const { setAiSummaryAnswer, setNewLoading, aiRefId } = useAiSummaryStore.getState()

      const ai = { ai_summary: String(!!AISearchQuery) }

      if (!AISearchQuery) {
        set(currentPage === 0 ? { isFetching: true } : { isLoadingNew: true })
      }

      if (AISearchQuery) {
        setNewLoading({ question: AISearchQuery, answerLoading: true })
      }

      if (abortController) {
        abortController.abort('abort')
      }

      const controller = new AbortController()
      const { signal } = controller

      abortController = controller

      const { node_type: filterNodeTypes, ...withoutNodeType } = filters
      const word = AISearchQuery || currentSearch

      const isLatest = isEqual(filters, defaultData.filters) && !word

      const updatedParams = {
        ...withoutNodeType,
        ...ai,
        skip: currentPage === 0 ? String(currentPage * itemsPerPage) : String(currentPage * itemsPerPage + 1),
        limit: word ? '25' : String(itemsPerPage),
        ...(filterNodeTypes.length > 0 ? { node_type: JSON.stringify(filterNodeTypes) } : {}),
        ...(word ? { word } : {}),
        ...(aiRefId && AISearchQuery ? { previous_search_ref_id: aiRefId } : {}),
      }

      try {
        const data = await fetchGraphData(setBudget, updatedParams, isLatest, signal, setAbortRequests)

        if (data?.query_data?.ref_id) {
          useAiSummaryStore.setState({ aiRefId: data.query_data.ref_id })

          const { aiSummaryAnswers } = useAiSummaryStore.getState()
          const { answer } = aiSummaryAnswers[data.query_data.ref_id] || {}

          setAiSummaryAnswer(data.query_data.ref_id, {
            question: AISearchQuery,
            answer: answer || '',
            answerLoading: !answer,
            sourcesLoading: !answer,
            shouldRender: true,
          })

          setNewLoading(null)
        }

        if (data?.nodes) {
          addNewNode(data)
        }

        set({ isFetching: false, isLoadingNew: false, splashDataLoading: false })
      } catch (error) {
        console.error(error)

        if (error !== 'abort') {
          set({ isFetching: false, isLoadingNew: false })
        }
      }
    },

    addNewNode: (data) => {
      const { dataInitial: existingData, filters, nodesNormalized, linksNormalized } = get()

      if (!data?.nodes) {
        return
      }

      // Initialize maps if not already present
      const normalizedNodesMap = nodesNormalized || new Map()
      const normalizedLinksMap = linksNormalized || new Map()

      // Filter nodes based on filters.node_type
      const nodesFilteredByFilters = filters.node_type.length
        ? data.nodes.filter((node) => filters.node_type.includes(node.node_type))
        : data.nodes

      // Add new nodes directly to the Map
      const newNodes: Node[] = []

      nodesFilteredByFilters.forEach((node) => {
        if (!normalizedNodesMap.has(node.ref_id)) {
          normalizedNodesMap.set(node.ref_id, node)
          newNodes.push(node)
        }
      })

      // Get existing nodes and add new nodes
      const currentNodes = existingData?.nodes || []
      const updatedNodes = [...currentNodes, ...newNodes]

      // Filter and add new links
      const newLinks: Link[] = []

      const edges = data.edges || []

      edges.forEach((link: Link) => {
        if (
          !normalizedLinksMap.has(link.ref_id) && // Ensure link is unique
          normalizedNodesMap.has(link.source) && // Ensure source node exists
          normalizedNodesMap.has(link.target) // Ensure target node exists
        ) {
          normalizedLinksMap.set(link.ref_id, link)
          newLinks.push(link)
        }
      })

      // Get existing links and add new links
      const currentLinks = existingData?.links || []
      const updatedLinks = [...currentLinks, ...newLinks]

      // Update node types and sidebar filters
      const nodeTypes = [...new Set(updatedNodes.map((node) => node.node_type))]
      const sidebarFilters = ['all', ...nodeTypes.map((type) => type.toLowerCase())]

      const sidebarFilterCounts = sidebarFilters.map((filter) => ({
        name: filter,
        count: updatedNodes.filter((node) => filter === 'all' || node.node_type?.toLowerCase() === filter).length,
      }))

      // Persist updates
      set({
        dataInitial: { nodes: updatedNodes, links: updatedLinks },
        dataNew: { nodes: newNodes, links: newLinks },
        nodeTypes,
        sidebarFilters,
        sidebarFilterCounts,
        nodesNormalized: normalizedNodesMap,
        linksNormalized: normalizedLinksMap,
      })
    },

    abortFetchData: () => {
      if (abortController) {
        abortController.abort('abort')
      }
    },
    resetGraph: () => {
      const { setAbortRequests } = get()
      const { setBudget } = useUserStore.getState()

      set({
        filters: defaultData.filters,
        dataInitial: null,
        dataNew: null,
      })

      get().fetchData(setBudget, setAbortRequests)
    },

    resetData: () => {
      set({
        dataInitial: null,
        sidebarFilter: 'all',
        sidebarFilters: [],
        sidebarFilterCounts: [],
        dataNew: null,
        runningProjectId: '',
        nodeTypes: [],
        nodesNormalized: new Map<string, Node>(),
        linksNormalized: new Map<string, Link>(),
      })
    },

    nextPage: () => {
      const { filters, fetchData, setAbortRequests } = get()
      const { setBudget } = useUserStore.getState()

      set({ filters: { ...filters, skip: filters.skip + 1 } })
      fetchData(setBudget, setAbortRequests)
    },
    resetDataNew: () => null,
    setFilters: (filters: Partial<FilterParams>) => {
      const { setBudget } = useUserStore.getState()

      set((state) => ({ filters: { ...state.filters, ...filters, skip: 0 } }))
      get().fetchData(setBudget, get().setAbortRequests)
    },
    setSidebarFilterCounts: (sidebarFilterCounts) => set({ sidebarFilterCounts }),
    setTrendingTopics: (trendingTopics) => set({ trendingTopics }),
    setStats: (stats) => set({ stats }),
    setIsFetching: (isFetching) => set({ isFetching }),

    setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
    setQueuedSources: (queuedSources) => set({ queuedSources }),
    setSidebarFilter: (sidebarFilter: string) => set({ sidebarFilter }),
    setSelectedTimestamp: (selectedTimestamp) => set({ selectedTimestamp }),
    setSources: (sources) => set({ sources }),
    setHideNodeDetails: (hideNodeDetails) => set({ hideNodeDetails }),
    setSeedQuestions: (questions) => set({ seedQuestions: questions }),
    updateNode: (updatedNode) => {
      console.info(updatedNode)
    },

    removeNode: (id) => {
      console.log(id)
    },

    setRunningProjectId: (runningProjectId) => set({ runningProjectId, runningProjectMessages: [] }),
    setRunningProjectMessages: (message) => {
      const { runningProjectMessages } = get()

      set({ runningProjectMessages: [...runningProjectMessages, message] })
    },
    resetRunningProjectMessages: () => set({ runningProjectMessages: [] }),
    setAbortRequests: (abortRequest) => set({ abortRequest }),
  })),
)

export const useFilteredNodes = () =>
  useDataStore((s) => {
    if (s.sidebarFilter === 'all') {
      return s.dataInitial?.nodes || []
    }

    return (s.dataInitial?.nodes || []).filter((i) => i.node_type?.toLowerCase() === s.sidebarFilter.toLowerCase())
  })

export const useNodeTypes = () => useDataStore((s) => s.nodeTypes)
