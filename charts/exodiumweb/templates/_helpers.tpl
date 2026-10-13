{{- define "exodiumweb.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}{{ .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else -}}{{ printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}{{- end -}}
{{- end -}}

{{- define "exodiumweb.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "exodiumweb.labels" -}}
{{ include "exodiumweb.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "exodiumweb.collectionVolume" -}}
{{- $c := .Values.collection -}}
{{- if $c.existingClaim }}
persistentVolumeClaim: { claimName: {{ $c.existingClaim }}, readOnly: true }
{{- else if $c.nfs.server }}
nfs: { server: {{ $c.nfs.server }}, path: {{ $c.nfs.path }}, readOnly: true }
{{- else if $c.hostPath }}
hostPath: { path: {{ $c.hostPath }}, type: Directory }
{{- else }}
{{- fail "set collection.hostPath, collection.nfs or collection.existingClaim to your eXoDOS folder" }}
{{- end }}
{{- end -}}
