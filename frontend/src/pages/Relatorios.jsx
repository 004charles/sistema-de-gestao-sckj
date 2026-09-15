import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

const Relatorios = () => {
  const [dados, setDados] = useState([
    {
      id: 1,
      empresa: 'Empresa Alpha Lda',
      nif: '5417689234',
      total: 12,
      conciliadas: 11,
      divergencias: 1,
      percentual: 91.7,
    },
    {
      id: 2,
      empresa: 'Beta Comércio',
      nif: '5417689235',
      total: 10,
      conciliadas: 8,
      divergencias: 2,
      percentual: 80.0,
    },
    {
      id: 3,
      empresa: 'Gamma Serviços',
      nif: '5417689236',
      total: 8,
      conciliadas: 8,
      divergencias: 0,
      percentual: 100.0,
    },
    {
      id: 4,
      empresa: 'Delta Indústria',
      nif: '5417689237',
      total: 6,
      conciliadas: 5,
      divergencias: 1,
      percentual: 83.3,
    },
  ]);

  const totalGeral = dados.reduce((acc, item) => acc + item.total, 0);
  const totalConciliadas = dados.reduce((acc, item) => acc + item.conciliadas, 0);
  const totalDivergencias = dados.reduce((acc, item) => acc + item.divergencias, 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <Typography variant="h4" sx={{ color: '#323130', fontWeight: 600 }}>
          Relatórios
        </Typography>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          sx={{
            backgroundColor: '#0078D4',
            textTransform: 'none',
            '&:hover': { backgroundColor: '#005A9E' },
          }}
        >
          Exportar PDF
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ marginBottom: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid #0078D4' }}>
            <CardContent>
              <Typography variant="body2" sx={{ color: '#605E5C', marginBottom: 1 }}>
                Total de Reconciliações
              </Typography>
              <Typography variant="h3" sx={{ color: '#323130', fontWeight: 600 }}>
                {totalGeral}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid #107C10' }}>
            <CardContent>
              <Typography variant="body2" sx={{ color: '#605E5C', marginBottom: 1 }}>
                Conciliadas
              </Typography>
              <Typography variant="h3" sx={{ color: '#107C10', fontWeight: 600 }}>
                {totalConciliadas}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid #D13438' }}>
            <CardContent>
              <Typography variant="body2" sx={{ color: '#605E5C', marginBottom: 1 }}>
                Com Divergências
              </Typography>
              <Typography variant="h3" sx={{ color: '#D13438', fontWeight: 600 }}>
                {totalDivergencias}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ padding: 3 }}>
        <Typography variant="h6" sx={{ color: '#323130', fontWeight: 600, marginBottom: 2 }}>
          Resumo por Empresa
        </Typography>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F3F2F1' }}>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>Empresa</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130' }}>NIF</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'center' }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'center' }}>Conciliadas</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'center' }}>Divergências</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#323130', textAlign: 'center' }}>% Sucesso</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dados.map((row) => (
                <TableRow key={row.id} sx={{ '&:hover': { backgroundColor: '#FAF9F8' } }}>
                  <TableCell sx={{ fontWeight: 500 }}>{row.empresa}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.nif}</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>{row.total}</TableCell>
                  <TableCell sx={{ textAlign: 'center', color: '#107C10', fontWeight: 600 }}>
                    {row.conciliadas}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    {row.divergencias > 0 ? (
                      <Chip
                        icon={<WarningIcon />}
                        label={row.divergencias}
                        size="small"
                        sx={{
                          backgroundColor: '#FDE7E9',
                          color: '#D13438',
                          '& .MuiChip-icon': { color: '#D13438' },
                        }}
                      />
                    ) : (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="0"
                        size="small"
                        sx={{
                          backgroundColor: '#E6F4E6',
                          color: '#107C10',
                          '& .MuiChip-icon': { color: '#107C10' },
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          width: 60,
                          height: 6,
                          backgroundColor: '#EDEBE9',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            width: `${row.percentual}%`,
                            height: '100%',
                            backgroundColor: row.percentual === 100 ? '#107C10' : '#0078D4',
                            borderRadius: 3,
                          }}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: '#605E5C', fontWeight: 500 }}>
                        {row.percentual.toFixed(1)}%
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default Relatorios;
